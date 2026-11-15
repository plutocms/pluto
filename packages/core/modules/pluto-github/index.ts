import type { PlutoGithubOptions } from './options'
import { resolve } from 'node:path'
import {
  addComponent,
  addImportsDir,
  addPlugin,
  addServerHandler,
  addServerPlugin,
  createResolver,
  defineNuxtModule,
  extendPages,
  useLogger,
} from '@nuxt/kit'
import { isStaticBuild } from '../pluto-static/static-build'
import { readGitOrigin } from './git-remote'
import { PLUTO_GITHUB_SECRET_ENV, resolvePlutoGithubOptions } from './options'
import { detectDeployHost } from './runtime/shared/domain'
import { SNAPSHOT_ASSETS } from './runtime/shared/snapshot'

export type { PlutoGithubOptions } from './options'

interface LayerMeta {
  name?: string
  plutoBackend?: boolean
}

interface LayerConfigMeta {
  $meta?: LayerMeta
}

export default defineNuxtModule<PlutoGithubOptions>({
  meta: { name: 'pluto-github', configKey: 'plutoGithub' },
  defaults: { enabled: 'auto' },
  setup(options, nuxt) {
    if (options.enabled === false) {
      return
    }

    const logger = useLogger('pluto-github')

    const layers = nuxt.options._layers ?? []
    const modules = (nuxt.options.modules ?? []).map((entry) =>
      Array.isArray(entry) ? entry[0] : entry
    )
    const hasBackendLayer =
      layers.some((layer) => {
        const meta = (layer.config as LayerConfigMeta | undefined)?.$meta
        return meta?.name === 'supabase' || meta?.plutoBackend === true
      }) || modules.includes('@nuxtjs/supabase')

    const isStatic = isStaticBuild(nuxt)

    const { enabled, resolved, warnings, errors } = resolvePlutoGithubOptions(
      options,
      {
        dev: nuxt.options.dev,
        hasBackendLayer,
        env: process.env,
        gitOrigin: nuxt.options.dev
          ? readGitOrigin(nuxt.options.rootDir)
          : undefined,
        static: isStatic,
      }
    )

    if (!nuxt.options._prepare) {
      for (const warning of warnings) {
        logger.warn(warning)
      }
    }
    if (!(options.enabled === 'auto' && nuxt.options._prepare)) {
      for (const error of errors) {
        logger.error(error)
      }
    }
    if (!enabled) {
      return
    }

    const secrets: Record<string, string | number | boolean> = {}
    for (const name of [
      ...PLUTO_GITHUB_SECRET_ENV.required,
      ...PLUTO_GITHUB_SECRET_ENV.optional,
    ]) {
      secrets[toCamelCase(name)] = ''
    }

    const deployHost = detectDeployHost(process.env)

    Object.assign(secrets, {
      apiUrl: resolved.github.apiUrl,
      skipDeploy: resolved.commit.skipDeploy,
      localCommit: resolved.commit.local && !isStatic,
      headTtl: resolved.cache.headTtl,
      cacheStorage: resolved.cache.storage,
      postType: resolved.postType,
      fsRoot: resolved.storage === 'fs' ? nuxt.options.rootDir : '',
      rootDir: nuxt.options.dev ? nuxt.options.rootDir : '',
      host: deployHost.id,
      hostSite: deployHost.site,
    })

    nuxt.options.runtimeConfig.plutoGithub =
      secrets as typeof nuxt.options.runtimeConfig.plutoGithub
    nuxt.options.runtimeConfig.public.plutoGithub = {
      enabled: true,
      repo: resolved.github.repo,
      branch: resolved.github.branch,
      appSlug: resolved.github.appSlug,
      storage: resolved.storage,
      dir: resolved.dir,
      postType: resolved.postType,
      skipDeploy: resolved.commit.skipDeploy,
      static: isStatic,
    }
    const media = nuxt.options.runtimeConfig.public.plutoMedia as
      Record<string, unknown> | undefined
    nuxt.options.runtimeConfig.public.plutoMedia = {
      ...media,
      driver: 'github',
    } as typeof nuxt.options.runtimeConfig.public.plutoMedia

    const resolver = createResolver(import.meta.url)
    const server = (file: string) => resolver.resolve('./runtime/server', file)
    const addRoute = (
      route: string,
      method: 'get' | 'post' | 'delete',
      file: string
    ) => {
      if (!isStatic) {
        addServerHandler({ route, method, handler: server(file) })
      }
    }

    addServerPlugin(server('plugins/pluto-github'))

    if (resolved.storage === 'github' && !isStatic) {
      nuxt.options.nitro ||= {}
      nuxt.options.nitro.serverAssets ||= []
      nuxt.options.nitro.serverAssets.push({
        baseName: SNAPSHOT_ASSETS,
        dir: resolve(nuxt.options.rootDir ?? '', resolved.dir),
        pattern: '**/*.md',
      })
    }

    addRoute(
      '/api/_pluto/auth/github/login',
      'get',
      'api/auth/github/login.get'
    )
    addRoute(
      '/api/_pluto/auth/github/callback',
      'get',
      'api/auth/github/callback.get'
    )
    addRoute('/api/_pluto/auth/logout', 'post', 'api/auth/logout.post')
    addRoute('/api/_pluto/auth/session', 'get', 'api/auth/session.get')

    addPlugin({ src: resolver.resolve('./runtime/app/plugins/pluto-github') })
    addImportsDir(resolver.resolve('./runtime/app/composables'))

    addComponent({
      name: 'PlutoMarkdownSource',
      filePath: resolver.resolve(
        '../../app/components/Pluto/Github/PlutoMarkdownSource.vue'
      ),
    })

    const settingsFile = resolver.resolve(
      '../../app/components/Pluto/Github/PlutoGithubSettingsPage.vue'
    )
    const deployFile = resolver.resolve(
      '../../app/components/Pluto/Github/PlutoGithubDeployPage.vue'
    )
    const usersFile = resolver.resolve(
      '../../app/components/Pluto/Github/PlutoGithubUsersPage.vue'
    )
    extendPages((pages) => {
      const admin = pages.find((page) => page.path === '/admin')
      if (admin) {
        admin.children ||= []
        admin.children.push({
          name: 'admin-users',
          path: 'users',
          file: usersFile,
        })
      } else {
        logger.warn('Could not find the admin page. The Users page is off.')
      }
      const settings = admin?.children?.find((page) => page.path === 'settings')
      if (settings) {
        settings.children ||= []
        settings.children.push({
          name: 'admin-settings-github',
          path: 'github',
          file: settingsFile,
        })
        settings.children.push({
          name: 'admin-settings-deploy',
          path: 'deploy',
          file: deployFile,
        })
      } else {
        logger.warn('Could not find the Settings page. The GitHub tab is off.')
      }
    })

    addRoute('/api/_pluto/github/setup/status', 'get', 'api/setup/status.get')
    addRoute('/api/_pluto/github/setup/start', 'get', 'api/setup/start.get')
    addRoute(
      '/api/_pluto/github/setup/callback',
      'get',
      'api/setup/callback.get'
    )

    addRoute('/api/_pluto/github/build-status', 'get', 'api/build-status.get')

    addRoute('/api/_pluto/github/deploy/status', 'get', 'api/deploy/status.get')
    addRoute('/api/_pluto/github/deploy/pages', 'post', 'api/deploy/pages.post')
    addRoute(
      '/api/_pluto/github/deploy/pages',
      'delete',
      'api/deploy/pages.delete'
    )
    addRoute('/api/_pluto/github/deploy/dns', 'get', 'api/deploy/dns.get')

    addRoute('/api/_pluto/github/users', 'get', 'api/users.get')

    if (nuxt.options.dev && resolved.storage === 'fs') {
      addRoute('/api/_pluto/github/local/status', 'get', 'api/local/status.get')
      addRoute('/api/_pluto/github/local/push', 'post', 'api/local/push.post')
    }

    addRoute('/media/**', 'get', 'routes/media.get')

    logger.info(
      `Standalone CMS on. Storage: ${resolved.storage}. Dir: ${resolved.dir}.`
    )
  },
})

function toCamelCase(name: string): string {
  return name
    .toLowerCase()
    .replace(/_([a-z])/g, (_match, char: string) => char.toUpperCase())
}

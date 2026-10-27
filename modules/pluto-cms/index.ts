import type { PlutoCmsOptions } from './options'
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
import { readGitOrigin } from './git-remote'
import { PLUTO_CMS_SECRET_ENV, resolvePlutoCmsOptions } from './options'

export type { PlutoCmsOptions } from './options'

interface LayerMeta {
  name?: string
  /** A backend layer sets this to `true`, so the standalone CMS stays off. */
  plutoBackend?: boolean
}

interface LayerConfigMeta {
  $meta?: LayerMeta
}

/**
 * The optional standalone CMS: Markdown posts in a GitHub repo, edited in the
 * Pluto admin. `plutoCms.enabled` is `'auto'` by default: the CMS is on unless
 * a backend layer is present or the app sets `false`. An explicit `true` with a
 * backend layer logs an error. When the CMS is off, the module adds nothing to
 * the app. See the github-cms skill.
 */
export default defineNuxtModule<PlutoCmsOptions>({
  meta: { name: 'pluto-cms', configKey: 'plutoCms' },
  defaults: { enabled: 'auto' },
  setup(options, nuxt) {
    // Off when the app says so. Return before any other work.
    if (options.enabled === false) {
      return
    }

    const logger = useLogger('pluto-cms')

    // A backend app uses the `supabase` layer, the `@nuxtjs/supabase` module, or
    // a layer with `$meta.plutoBackend: true`.
    const layers = nuxt.options._layers ?? []
    const modules = (nuxt.options.modules ?? []).map((entry) => Array.isArray(entry) ? entry[0] : entry)
    const hasBackendLayer
      = layers.some((layer) => {
        const meta = (layer.config as LayerConfigMeta | undefined)?.$meta
        return meta?.name === 'supabase' || meta?.plutoBackend === true
      })
      || modules.includes('@nuxtjs/supabase')

    const { enabled, resolved, warnings, errors } = resolvePlutoCmsOptions(options, {
      dev: nuxt.options.dev,
      hasBackendLayer,
      env: process.env,
      // The git remote is a dev-only default for the repo. No shell call.
      gitOrigin: nuxt.options.dev ? readGitOrigin(nuxt.options.rootDir) : undefined,
    })

    if (!nuxt.options._prepare) {
      for (const warning of warnings) {
        logger.warn(warning)
      }
    }
    // `nuxt prepare` runs in every install. An auto-enabled CMS stays quiet there.
    if (!(options.enabled === 'auto' && nuxt.options._prepare)) {
      for (const error of errors) {
        logger.error(error)
      }
    }
    if (!enabled) {
      return
    }

    // Empty placeholders, so a `NUXT_PLUTO_CMS_<NAME>` env var overrides them
    // at run time. The module does not check them at build time.
    const secrets: Record<string, string | number | boolean> = {}
    for (const name of [...PLUTO_CMS_SECRET_ENV.required, ...PLUTO_CMS_SECRET_ENV.optional]) {
      secrets[toCamelCase(name)] = ''
    }

    // Non-secret settings for the server code. They stay out of the public
    // config. `fsRoot` is set for the dev `fs` store only.
    Object.assign(secrets, {
      apiUrl: resolved.github.apiUrl,
      skipDeploy: resolved.commit.skipDeploy,
      headTtl: resolved.cache.headTtl,
      cacheStorage: resolved.cache.storage,
      postType: resolved.postType,
      fsRoot: resolved.storage === 'fs' ? nuxt.options.rootDir : '',
      // Development only: the setup writes the `.env` file there.
      rootDir: nuxt.options.dev ? nuxt.options.rootDir : '',
    })

    nuxt.options.runtimeConfig.plutoCms = secrets as typeof nuxt.options.runtimeConfig.plutoCms
    nuxt.options.runtimeConfig.public.plutoCms = {
      enabled: true,
      repo: resolved.github.repo,
      branch: resolved.github.branch,
      appSlug: resolved.github.appSlug,
      storage: resolved.storage,
      dir: resolved.dir,
      postType: resolved.postType,
      skipDeploy: resolved.commit.skipDeploy,
    }

    const resolver = createResolver(import.meta.url)
    const server = (file: string) => resolver.resolve('./runtime/server', file)

    // Server: the sign-in routes, and the Nitro plugin that
    // registers the store, the adapter and the post type.
    addServerHandler({ route: '/api/_pluto/auth/github/login', method: 'get', handler: server('api/auth/github/login.get') })
    addServerHandler({ route: '/api/_pluto/auth/github/callback', method: 'get', handler: server('api/auth/github/callback.get') })
    addServerHandler({ route: '/api/_pluto/auth/logout', method: 'post', handler: server('api/auth/logout.post') })
    addServerHandler({ route: '/api/_pluto/auth/session', method: 'get', handler: server('api/auth/session.get') })
    addServerPlugin(server('plugins/pluto-cms'))

    // Client: the extension plugin and the session composable. Core owns the
    // admin routes, the login page and the route guard.
    addPlugin({ src: resolver.resolve('./runtime/app/plugins/pluto-cms') })
    addImportsDir(resolver.resolve('./runtime/app/composables'))

    // `PlutoMarkdown` shows the sanitized HTML of a public item. The file lives
    // under `app/`, so Tailwind scans it. Nuxt would name it from its folder, so
    // the module gives it the short name.
    addComponent({
      name: 'PlutoMarkdown',
      filePath: resolver.resolve('../../app/components/Pluto/Cms/PlutoMarkdown.vue'),
    })

    // `PlutoMarkdownSource` is the raw Markdown editor. A layer uses it to build its own
    // field widget (the docs layer wraps it). The module gives it the short name.
    addComponent({
      name: 'PlutoMarkdownSource',
      filePath: resolver.resolve('../../app/components/Pluto/Cms/PlutoMarkdownSource.vue'),
    })

    // The GitHub tab of Settings. The page file lives under `app/`, so Tailwind scans it.
    // It is a child of the Settings page (`/admin/settings`), so it shows in its tabs.
    const settingsFile = resolver.resolve('../../app/components/Pluto/Cms/PlutoCmsSettingsPage.vue')
    extendPages((pages) => {
      const settings = pages.find((page) => page.path === '/admin')?.children?.find((page) => page.path === 'settings')
      if (settings) {
        settings.children ||= []
        settings.children.push({ name: 'admin-settings-github', path: 'github', file: settingsFile })
      } else {
        logger.warn('Could not find the Settings page. The GitHub tab is off.')
      }
    })

    // Setup routes: the checks and the App Manifest flow. See the github-cms skill.
    // They are static, so they win over the `:type/:slug` route below.
    addServerHandler({ route: '/api/_pluto/cms/setup/status', method: 'get', handler: server('api/setup/status.get') })
    addServerHandler({ route: '/api/_pluto/cms/setup/github/start', method: 'get', handler: server('api/setup/github/start.get') })
    addServerHandler({ route: '/api/_pluto/cms/setup/github/callback', method: 'get', handler: server('api/setup/github/callback.get') })

    // The build status of the head commit. It needs a signed-in user.
    addServerHandler({ route: '/api/_pluto/cms/build-status', method: 'get', handler: server('api/build-status.get') })

    // The public reads of the posts go through the public API of core (`/api/pluto/v1/content/post`).

    logger.info(`Standalone CMS on. Storage: ${resolved.storage}. Dir: ${resolved.dir}.`)
  },
})

/** `GITHUB_APP_ID` becomes `githubAppId`. */
function toCamelCase(name: string): string {
  return name
    .toLowerCase()
    .replace(/_([a-z])/g, (_match, char: string) => char.toUpperCase())
}

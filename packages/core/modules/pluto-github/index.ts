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
import { readGitOrigin } from './git-remote'
import { PLUTO_GITHUB_SECRET_ENV, resolvePlutoGithubOptions } from './options'
import { detectDeployHost } from './runtime/shared/domain'
import { SNAPSHOT_ASSETS } from './runtime/shared/snapshot'

export type { PlutoGithubOptions } from './options'

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
 * Pluto admin. `plutoGithub.enabled` is `'auto'` by default: the CMS is on unless
 * a backend layer is present or the app sets `false`. An explicit `true` with a
 * backend layer logs an error. When the CMS is off, the module adds nothing to
 * the app. See the git-cms skill.
 */
export default defineNuxtModule<PlutoGithubOptions>({
  meta: { name: 'pluto-github', configKey: 'plutoGithub' },
  defaults: { enabled: 'auto' },
  setup(options, nuxt) {
    // Off when the app says so. Return before any other work.
    if (options.enabled === false) {
      return
    }

    const logger = useLogger('pluto-github')

    // A backend app uses the `supabase` layer, the `@nuxtjs/supabase` module, or
    // a layer with `$meta.plutoBackend: true`.
    const layers = nuxt.options._layers ?? []
    const modules = (nuxt.options.modules ?? []).map((entry) =>
      Array.isArray(entry) ? entry[0] : entry
    )
    const hasBackendLayer =
      layers.some((layer) => {
        const meta = (layer.config as LayerConfigMeta | undefined)?.$meta
        return meta?.name === 'supabase' || meta?.plutoBackend === true
      }) || modules.includes('@nuxtjs/supabase')

    // A static build (`nuxt generate`, or a static Nitro preset such as `github_pages`): the pages
    // are prerendered from the files of the checkout. The output has no server, so the module adds
    // no sign-in, admin or write route.
    // `_generate` is the internal flag of `nuxt generate`. It is not in the public types.
    const generate = (nuxt.options as { _generate?: boolean })._generate
    const isStatic =
      !nuxt.options.dev &&
      (Boolean(generate || nuxt.options.nitro?.static) ||
        isStaticPreset(nuxt.options.nitro?.preset ?? process.env.NITRO_PRESET))

    const { enabled, resolved, warnings, errors } = resolvePlutoGithubOptions(
      options,
      {
        dev: nuxt.options.dev,
        hasBackendLayer,
        env: process.env,
        // The git remote is a dev-only default for the repo. No shell call.
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
    // `nuxt prepare` runs in every install. An auto-enabled CMS stays quiet there.
    if (!(options.enabled === 'auto' && nuxt.options._prepare)) {
      for (const error of errors) {
        logger.error(error)
      }
    }
    if (!enabled) {
      return
    }

    // Empty placeholders, so a `NUXT_PLUTO_GITHUB_<NAME>` env var overrides them
    // at run time. The module does not check them at build time.
    const secrets: Record<string, string | number | boolean> = {}
    for (const name of [
      ...PLUTO_GITHUB_SECRET_ENV.required,
      ...PLUTO_GITHUB_SECRET_ENV.optional,
    ]) {
      secrets[toCamelCase(name)] = ''
    }

    const deployHost = detectDeployHost(process.env)

    // Non-secret settings for the server code. They stay out of the public
    // config. `fsRoot` is set for the dev `fs` store only.
    Object.assign(secrets, {
      apiUrl: resolved.github.apiUrl,
      skipDeploy: resolved.commit.skipDeploy,
      // A static build only reads.
      localCommit: resolved.commit.local && !isStatic,
      headTtl: resolved.cache.headTtl,
      cacheStorage: resolved.cache.storage,
      postType: resolved.postType,
      fsRoot: resolved.storage === 'fs' ? nuxt.options.rootDir : '',
      // Development only: the setup writes the `.env` file there.
      rootDir: nuxt.options.dev ? nuxt.options.rootDir : '',
      // The host that builds the app (Vercel, Netlify). The Deploy tab links to its domain settings.
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
      // A static build has no server: the client asks for no session.
      static: isStatic,
    }
    // The media library of core uses the GitHub driver (runtime/server/media.ts).
    const media = nuxt.options.runtimeConfig.public.plutoMedia as
      Record<string, unknown> | undefined
    nuxt.options.runtimeConfig.public.plutoMedia = {
      ...media,
      driver: 'github',
    } as typeof nuxt.options.runtimeConfig.public.plutoMedia

    const resolver = createResolver(import.meta.url)
    const server = (file: string) => resolver.resolve('./runtime/server', file)
    // A route of the server build. A static build has no server, so it adds none.
    const addRoute = (
      route: string,
      method: 'get' | 'post' | 'delete',
      file: string
    ) => {
      if (!isStatic) {
        addServerHandler({ route, method, handler: server(file) })
      }
    }

    // The Nitro plugin registers the store, the adapter and the post type. A static build needs
    // it too: the public API reads the files while the pages prerender.
    addServerPlugin(server('plugins/pluto-github'))

    // A site that reads from GitHub bundles the Markdown of its content dir as it was at build
    // time (the host builds from a checkout). Until the server has a read token or the GitHub
    // App, the public pages read this snapshot instead of failing. See `withBuildSnapshot`.
    if (resolved.storage === 'github' && !isStatic) {
      nuxt.options.nitro ||= {}
      nuxt.options.nitro.serverAssets ||= []
      nuxt.options.nitro.serverAssets.push({
        baseName: SNAPSHOT_ASSETS,
        dir: resolve(nuxt.options.rootDir ?? '', resolved.dir),
        pattern: '**/*.md',
      })
    }

    if (isStatic) {
      // A project site of GitHub Pages lives under `/<repo>/`. The workflow gives the path in
      // `PLUTO_BASE_URL`, and the module writes it in the build config and the app config.
      // `NUXT_APP_BASE_URL` does not work here: the prerenderer reads it at run time too, the
      // paths then do not match, and every page answers a redirect.
      const basePath = process.env.PLUTO_BASE_URL?.trim()
      if (basePath) {
        const baseURL = normalizeBasePath(basePath)
        nuxt.options.app.baseURL = baseURL
        nuxt.options.runtimeConfig.app = {
          ...nuxt.options.runtimeConfig.app,
          baseURL,
        }
      }
      // The admin, the API routes of the admin and the preview pages stay out of the output.
      nuxt.options.nitro.prerender ||= {}
      nuxt.options.nitro.prerender.ignore = [
        ...(nuxt.options.nitro.prerender.ignore ?? []),
        '/admin',
        '/api/_pluto',
        '/_pluto',
      ]
    }

    // Server: the sign-in routes.
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

    // Client: the extension plugin and the session composable. Core owns the
    // admin routes, the login page and the route guard.
    addPlugin({ src: resolver.resolve('./runtime/app/plugins/pluto-github') })
    addImportsDir(resolver.resolve('./runtime/app/composables'))

    // `PlutoMarkdown` shows the sanitized HTML of a public item. The file lives
    // under `app/`, so Tailwind scans it. Nuxt would name it from its folder, so
    // the module gives it the short name.
    addComponent({
      name: 'PlutoMarkdown',
      filePath: resolver.resolve(
        '../../app/components/Pluto/Github/PlutoMarkdown.vue'
      ),
    })

    // `PlutoMarkdownSource` is the raw Markdown editor. A layer uses it to build its own
    // field widget (the docs layer wraps it). The module gives it the short name.
    addComponent({
      name: 'PlutoMarkdownSource',
      filePath: resolver.resolve(
        '../../app/components/Pluto/Github/PlutoMarkdownSource.vue'
      ),
    })

    // The GitHub tab of Settings. The page file lives under `app/`, so Tailwind scans it.
    // It is a child of the Settings page (`/admin/settings`), so it shows in its tabs.
    const settingsFile = resolver.resolve(
      '../../app/components/Pluto/Github/PlutoGithubSettingsPage.vue'
    )
    // The Deploy tab of Settings (`/admin/settings/deploy`): the hosts, and GitHub Pages.
    const deployFile = resolver.resolve(
      '../../app/components/Pluto/Github/PlutoGithubDeployPage.vue'
    )
    // The Users page (`/admin/users`): the people with write access to the repo, read only.
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

    // Setup routes: the checks and the App Manifest flow. See the git-cms skill.
    // They are static, so they win over the `:type/:slug` route below.
    addRoute('/api/_pluto/github/setup/status', 'get', 'api/setup/status.get')
    addRoute('/api/_pluto/github/setup/start', 'get', 'api/setup/start.get')
    addRoute(
      '/api/_pluto/github/setup/callback',
      'get',
      'api/setup/callback.get'
    )

    // The build status of the head commit. It needs a signed-in user.
    addRoute('/api/_pluto/github/build-status', 'get', 'api/build-status.get')

    // The Deploy tab: the facts of the hosts and the last Pages deploy, the DNS check of a domain
    // (signed-in user), and the GitHub Pages workflow setup (local mode on this computer only; the
    // handler checks it).
    addRoute('/api/_pluto/github/deploy/status', 'get', 'api/deploy/status.get')
    addRoute('/api/_pluto/github/deploy/pages', 'post', 'api/deploy/pages.post')
    addRoute(
      '/api/_pluto/github/deploy/pages',
      'delete',
      'api/deploy/pages.delete'
    )
    addRoute('/api/_pluto/github/deploy/dns', 'get', 'api/deploy/dns.get')

    // The people with write access to the repo, for the Users page. It needs a signed-in user.
    addRoute('/api/_pluto/github/users', 'get', 'api/users.get')

    // Local mode: the Git state of the project and the Push button of the backend badge.
    // A dev build with the `fs` store only. The handlers also check the request.
    if (nuxt.options.dev && resolved.storage === 'fs') {
      addRoute('/api/_pluto/github/local/status', 'get', 'api/local/status.get')
      addRoute('/api/_pluto/github/local/push', 'post', 'api/local/push.post')
    }

    // The public reads of the posts go through the public API of core (`/api/pluto/v1/content/post`).

    // The media files that are in the repo but not in a deploy yet. See the media skill.
    addRoute('/media/**', 'get', 'routes/media.get')

    logger.info(
      `Standalone CMS on. Storage: ${resolved.storage}. Dir: ${resolved.dir}.`
    )
  },
})

/** `APP_ID` becomes `appId`. */
function toCamelCase(name: string): string {
  return name
    .toLowerCase()
    .replace(/_([a-z])/g, (_match, char: string) => char.toUpperCase())
}

/** The Nitro presets that write only static files: `static`, `github_pages`, `*_static`. */
export function isStaticPreset(preset: unknown): boolean {
  if (typeof preset !== 'string') {
    return false
  }
  const name = preset.toLowerCase().replaceAll('-', '_')
  return (
    name === 'static' || name === 'github_pages' || name.endsWith('_static')
  )
}

/** `repo`, `/repo` and `/repo/` become `/repo/`. An empty path becomes `/`. */
export function normalizeBasePath(path: string): string {
  const segments = path.split('/').filter(Boolean)
  return segments.length > 0 ? `/${segments.join('/')}/` : '/'
}

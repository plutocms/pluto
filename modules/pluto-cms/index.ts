import type { PlutoCmsOptions } from './options'
import {
  addComponent,
  addImportsDir,
  addPlugin,
  addServerHandler,
  addServerPlugin,
  createResolver,
  defineNuxtModule,
  useLogger,
} from '@nuxt/kit'
import { PLUTO_CMS_SECRET_ENV, resolvePlutoCmsOptions } from './options'

export type { PlutoCmsOptions } from './options'

interface LayerMeta {
  name?: string
}

interface LayerConfigMeta {
  $meta?: LayerMeta
}

/**
 * The optional standalone CMS: Markdown posts in a GitHub repo, edited in the
 * Pluto admin. It is OFF unless the app sets `plutoCms.enabled: true`. It
 * refuses to run with the supabase layer. When it is off, the module adds
 * nothing to the app. See the github-cms skill.
 */
export default defineNuxtModule<PlutoCmsOptions>({
  meta: { name: 'pluto-cms', configKey: 'plutoCms' },
  defaults: { enabled: false },
  setup(options, nuxt) {
    // Off by default. Return before any other work.
    if (!options.enabled) {
      return
    }

    const logger = useLogger('pluto-cms')

    // A supabase app uses the `supabase` layer or the `@nuxtjs/supabase` module.
    const layers = nuxt.options._layers ?? []
    const modules = (nuxt.options.modules ?? []).map((entry) => Array.isArray(entry) ? entry[0] : entry)
    const hasSupabaseLayer
      = layers.some((layer) => (layer.config as LayerConfigMeta | undefined)?.$meta?.name === 'supabase')
        || modules.includes('@nuxtjs/supabase')

    const { enabled, resolved, warnings, errors } = resolvePlutoCmsOptions(options, {
      dev: nuxt.options.dev,
      hasSupabaseLayer,
    })

    if (!nuxt.options._prepare) {
      for (const warning of warnings) {
        logger.warn(warning)
      }
    }
    for (const error of errors) {
      logger.error(error)
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
      publicMaxAge: resolved.cache.publicMaxAge,
      cacheStorage: resolved.cache.storage,
      postType: resolved.postType,
      fsRoot: resolved.storage === 'fs' ? nuxt.options.rootDir : '',
    })

    nuxt.options.runtimeConfig.plutoCms = secrets as typeof nuxt.options.runtimeConfig.plutoCms
    nuxt.options.runtimeConfig.public.plutoCms = {
      enabled: true,
      repo: resolved.github.repo,
      branch: resolved.github.branch,
      appSlug: resolved.github.appSlug,
      storage: resolved.storage,
      dir: resolved.dir,
    }

    const resolver = createResolver(import.meta.url)
    const server = (file: string) => resolver.resolve('./runtime/server', file)

    // Server: the sign-in routes, the origin check and the Nitro plugin that
    // registers the store, the adapter and the post type.
    addServerHandler({ route: '/api/_pluto/auth/github/login', method: 'get', handler: server('api/auth/github/login.get') })
    addServerHandler({ route: '/api/_pluto/auth/github/callback', method: 'get', handler: server('api/auth/github/callback.get') })
    addServerHandler({ route: '/api/_pluto/auth/logout', method: 'post', handler: server('api/auth/logout.post') })
    addServerHandler({ route: '/api/_pluto/auth/session', method: 'get', handler: server('api/auth/session.get') })
    addServerHandler({ middleware: true, handler: server('middleware/pluto-cms-origin') })
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

    // Public read routes. They are anonymous and cacheable. See the github-cms skill.
    addServerHandler({ route: '/api/_pluto/cms/:type', method: 'get', handler: server('api/public/[type]/index.get') })
    addServerHandler({ route: '/api/_pluto/cms/:type/:slug', method: 'get', handler: server('api/public/[type]/[slug].get') })

    logger.info(`Standalone CMS on. Storage: ${resolved.storage}. Dir: ${resolved.dir}.`)
  },
})

/** `GITHUB_APP_ID` becomes `githubAppId`. */
function toCamelCase(name: string): string {
  return name
    .toLowerCase()
    .replace(/_([a-z])/g, (_match, char: string) => char.toUpperCase())
}

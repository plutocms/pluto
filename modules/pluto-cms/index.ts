import type { PlutoCmsOptions } from './options'
import { defineNuxtModule, useLogger } from '@nuxt/kit'
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
    const secrets: Record<string, string> = {}
    for (const name of [...PLUTO_CMS_SECRET_ENV.required, ...PLUTO_CMS_SECRET_ENV.optional]) {
      secrets[toCamelCase(name)] = ''
    }

    nuxt.options.runtimeConfig.plutoCms = secrets as typeof nuxt.options.runtimeConfig.plutoCms
    nuxt.options.runtimeConfig.public.plutoCms = {
      enabled: true,
      repo: resolved.github.repo,
      branch: resolved.github.branch,
      appSlug: resolved.github.appSlug,
      storage: resolved.storage,
      dir: resolved.dir,
    }

    // TODO(PR 3): add the storage drivers (memory, fs, github) and the cache.
    // TODO(PR 4): register the Markdown content adapter and the post type.
    // TODO(PR 5): add the server handlers for GitHub App sign-in and the
    //   sealed session, plus the Nitro plugin and the origin check.
    // TODO(PR 5): add the client plugin and the route middleware.
    // TODO(PR 6): add the `/admin/login` page with `extendPages`, the editor
    //   and the public read routes.

    logger.info(`Standalone CMS on. Storage: ${resolved.storage}. Dir: ${resolved.dir}.`)
  },
})

/** `GITHUB_APP_ID` becomes `githubAppId`. */
function toCamelCase(name: string): string {
  return name
    .toLowerCase()
    .replace(/_([a-z])/g, (_match, char: string) => char.toUpperCase())
}

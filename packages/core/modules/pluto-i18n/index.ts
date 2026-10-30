import type { PlutoI18nOptions } from './locale-files'
import { existsSync, readdirSync } from 'node:fs'
import { dirname } from 'node:path'
import {
  addTemplate,
  defineNuxtModule,
  getLayerDirectories,
  resolvePath,
  updateTemplates,
  useLogger,
} from '@nuxt/kit'
import {
  findLayerLocaleFiles,
  LOCALE_DIR,
  renderI18nTemplate,
  renderI18nTypes,
  renderServerI18nModule,
  resolveI18nOptions,
} from './locale-files'

export type { PlutoI18nOptions } from './locale-files'

/**
 * Finds every layer's `i18n/locales/<code>.json` and generates
 * `#build/pluto-i18n.mjs`: the locale codes and one lazy loader per locale.
 * The files of all layers merge, base layer first and the app last, so the
 * app overrides a layer's text. Adding a language is adding the JSON files.
 * No code change.
 *
 * The same files feed a Nitro virtual module, `#pluto-i18n-server`, for the
 * server translator (`usePlutoServerTranslator`).
 *
 * The module also puts the resolved options in
 * `runtimeConfig.public.plutoI18n`. See the i18n skill.
 */
export default defineNuxtModule<PlutoI18nOptions>({
  meta: { name: 'pluto-i18n', configKey: 'plutoI18n' },
  defaults: {},
  async setup(options, nuxt) {
    const logger = useLogger('pluto-i18n')
    const layerRoots = getLayerDirectories(nuxt).map((layer) => layer.root)

    function listDir(dir: string): string[] {
      return existsSync(dir) ? readdirSync(dir) : []
    }

    // Nuxt UI's locale files. The generated file imports them by absolute
    // path, so the app needs no direct `@nuxt/ui` dependency.
    const uiLocaleDir = dirname(
      await resolvePath('@nuxt/ui/runtime/locale/en.js')
    )
    const uiLocaleFiles = listDir(uiLocaleDir)
      .filter((name) => name.endsWith('.js'))
      .map((name) => name.slice(0, -'.js'.length))
      .filter((name) => name !== 'index')

    let files = findLayerLocaleFiles(layerRoots, listDir)
    const resolved = resolveI18nOptions(options, Object.keys(files))

    if (!nuxt.options._prepare) {
      for (const warning of resolved.warnings) {
        logger.warn(warning)
      }
    }

    nuxt.options.runtimeConfig.public.plutoI18n = {
      defaultLocale: resolved.defaultLocale,
      adminLocales: resolved.adminLocales,
      siteLocales: resolved.siteLocales,
      siteLocale: resolved.siteLocale,
      siteManaged: resolved.siteManaged,
    }

    addTemplate({
      filename: 'pluto-i18n.mjs',
      write: true,
      getContents: () =>
        renderI18nTemplate({
          files,
          defaultLocale: resolved.defaultLocale,
          uiLocaleDir,
          uiLocaleFiles,
        }),
    })

    // The server translator (`server/utils/pluto-i18n.ts`) reads the same
    // files through a Nitro virtual module. `files` is read when Nitro asks
    // for the module, so a new locale file shows up on the next build.
    nuxt.hook('nitro:config', (nitroConfig) => {
      nitroConfig.virtual ||= {}
      nitroConfig.virtual['#pluto-i18n-server'] = () =>
        renderServerI18nModule({ files, defaultLocale: resolved.defaultLocale })
    })

    addTemplate({
      filename: 'pluto-i18n.d.mts',
      write: true,
      getContents: renderI18nTypes,
    })

    // A new or removed locale file changes the generated file. Locale
    // codes and options come from the first run, so restart the dev server
    // after a new language. An edit of an existing file hot-reloads on its own.
    nuxt.hook('builder:watch', async (_event, path) => {
      const normalized = path.replaceAll('\\', '/')
      if (
        !normalized.includes(`/${LOCALE_DIR}/`) ||
        !normalized.endsWith('.json')
      ) {
        return
      }
      files = findLayerLocaleFiles(layerRoots, listDir)
      await updateTemplates({
        filter: (template) => template.filename.startsWith('pluto-i18n.'),
      })
    })
  },
})

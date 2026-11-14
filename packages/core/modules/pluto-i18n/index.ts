import type { MessageTree } from '../../app/composables/internal/i18n-core'
import type { PlutoI18nOptions } from './locale-files'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname } from 'node:path'
import {
  addTemplate,
  addTypeTemplate,
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
  renderMessageTypes,
  renderServerI18nModule,
  resolveI18nOptions,
} from './locale-files'

export type { PlutoI18nOptions } from './locale-files'

const MESSAGE_TYPES_FILE = 'types/pluto-i18n-messages.d.ts'

export default defineNuxtModule<PlutoI18nOptions>({
  meta: { name: 'pluto-i18n', configKey: 'plutoI18n' },
  defaults: {},
  async setup(options, nuxt) {
    const logger = useLogger('pluto-i18n')
    const layerRoots = getLayerDirectories(nuxt).map((layer) => layer.root)

    function listDir(dir: string): string[] {
      return existsSync(dir) ? readdirSync(dir) : []
    }

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

    function readMessageTree(file: string): MessageTree[] {
      try {
        return [JSON.parse(readFileSync(file, 'utf8')) as MessageTree]
      } catch {
        logger.warn(`Could not read ${file} for the message types.`)
        return []
      }
    }

    addTypeTemplate(
      {
        filename: MESSAGE_TYPES_FILE,
        getContents: () =>
          renderMessageTypes(
            (files.en ?? files[resolved.defaultLocale] ?? []).flatMap(
              readMessageTree
            )
          ),
      },
      { nuxt: true, nitro: true, shared: true }
    )

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
        filter: (template) =>
          template.filename.startsWith('pluto-i18n.') ||
          template.filename === MESSAGE_TYPES_FILE,
      })
    })
  },
})

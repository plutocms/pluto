import { existsSync, readFileSync } from 'node:fs'
import {
  addTemplate,
  defineNuxtModule,
  getLayerDirectories,
  resolvePath,
  useLogger,
} from '@nuxt/kit'
import {
  analyzeCssEntry,
  checkCssSetup,
  findLayerCssFiles,
  renderPlutoCss,
  renderPlutoEntryCss,
  resolveRelativeImport,
} from './css-entries'

export interface PlutoCssOptions {
  /** Warn at build time about a CSS setup that breaks the single build. Default true. */
  check?: boolean
}

/**
 * One Tailwind build per app. The app's CSS entry owns the build:
 *
 *   @import 'tailwindcss';
 *   @import '@nuxt/ui';
 *   @import '#build/pluto.css';
 *
 * - `#build/pluto.css` imports each layer's app/assets/css/pluto-layer.css
 *   (tokens, the admin theme). Nuxt UI already adds `@source` for every
 *   layer's app/ dir, so this file adds no sources.
 * - An app with no Tailwind entry (a layer repo run on its own, or an app
 *   with no CSS) gets the fallback entry `#build/pluto-entry.css`.
 * - The module warns about a layer that registers its own Tailwind build,
 *   more than one build, or a missing import.
 *
 * See the single-tailwind-build skill.
 */
export default defineNuxtModule<PlutoCssOptions>({
  meta: { name: 'pluto-css', configKey: 'plutoCss' },
  defaults: { check: true },
  async setup(options, nuxt) {
    const logger = useLogger('pluto-css')
    const layers = getLayerDirectories(nuxt)
    const layerCssFiles = findLayerCssFiles(
      layers.map((layer) => layer.app),
      existsSync
    )

    addTemplate({
      filename: 'pluto.css',
      write: true,
      getContents: () => renderPlutoCss(layerCssFiles, nuxt.options.buildDir),
    })

    addTemplate({
      filename: 'pluto-entry.css',
      write: true,
      getContents: renderPlutoEntryCss,
    })

    const entries = []
    for (const entry of nuxt.options.css) {
      const file =
        typeof entry === 'string'
          ? await resolvePath(entry).catch(() => undefined)
          : undefined
      if (!file || !file.endsWith('.css') || !existsSync(file)) {
        continue
      }
      entries.push(
        analyzeCssEntry(
          file,
          (path) => (existsSync(path) ? readFileSync(path, 'utf8') : undefined),
          resolveRelativeImport
        )
      )
    }

    const appRoot = nuxt.options.rootDir
      .replaceAll('\\', '/')
      .replace(/\/?$/, '/')
    const layerRoots = layers
      .map((layer) => layer.root.replaceAll('\\', '/'))
      .filter((root) => root !== appRoot)
    const report = checkCssSetup(entries, layerRoots)

    if (report.injectFallback) {
      nuxt.options.css.push('#build/pluto-entry.css')
      if (!nuxt.options._prepare) {
        logger.info(
          'No CSS entry imports Tailwind. Using the Pluto fallback entry (#build/pluto-entry.css).'
        )
      }
    }

    if (options.check && !nuxt.options._prepare) {
      for (const warning of report.warnings) {
        logger.warn(warning)
      }
    }
  },
})

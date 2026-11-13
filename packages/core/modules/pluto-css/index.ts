import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  addTemplate,
  addVitePlugin,
  defineNuxtModule,
  getLayerDirectories,
  resolvePath,
  useLogger,
} from '@nuxt/kit'
import {
  analyzeCssEntry,
  checkCssSetup,
  findLayerCssFiles,
  LAYER_BASE_CSS_FILE,
  PLUTO_BASE_CSS_IMPORT,
  PLUTO_CSS_IMPORT,
  PLUTO_SITE_CSS_IMPORT,
  renderPlutoAdminCss,
  renderPlutoBaseCss,
  renderPlutoCss,
  renderPlutoSiteCss,
  resolveRelativeImport,
} from './css-entries'
import { scopeCss } from './scope'

export interface PlutoCssOptions {
  /** Warn at build time about a Tailwind build in a layer, or more than one. Default true. */
  check?: boolean
}

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

    const siteTheme = fileURLToPath(
      new URL('../../app/assets/css/pluto-site-theme.css', import.meta.url)
    )
    addTemplate({
      filename: 'pluto-site.css',
      write: true,
      getContents: () => renderPlutoSiteCss(siteTheme, nuxt.options.buildDir),
    })

    const layerBaseCssFiles = findLayerCssFiles(
      layers.map((layer) => layer.app),
      existsSync,
      LAYER_BASE_CSS_FILE
    )
    addTemplate({
      filename: 'pluto-base.css',
      write: true,
      getContents: () =>
        renderPlutoBaseCss(layerBaseCssFiles, nuxt.options.buildDir),
    })

    nuxt.options.alias[PLUTO_SITE_CSS_IMPORT] = join(
      nuxt.options.buildDir,
      'pluto-site.css'
    )
    nuxt.options.alias[PLUTO_BASE_CSS_IMPORT] = join(
      nuxt.options.buildDir,
      'pluto-base.css'
    )
    nuxt.options.alias[PLUTO_CSS_IMPORT] = join(
      nuxt.options.buildDir,
      'pluto.css'
    )

    addTemplate({
      filename: 'pluto-admin.css',
      getContents: renderPlutoAdminCss,
    })

    const inline = nuxt.options.features.inlineStyles
    if (inline) {
      nuxt.options.features.inlineStyles = (id) =>
        !id?.includes('PlutoAdminTheme.vue') && (inline === true || inline(id))
    }

    const adminCssFiles = new Set<string>()
    nuxt.hook('build:manifest', (manifest) => {
      for (const file of adminCssFiles) {
        if (manifest[file]) {
          manifest[file].prefetch = false
        }
      }
    })

    const adminCssId = /(?:[\\/]|%2F)pluto-admin\.css(?:\?|$)/
    addVitePlugin({
      name: 'pluto-css:scope-admin',
      transform(code, id) {
        if (adminCssId.test(id)) {
          return { code: scopeCss(code), map: null }
        }
      },
      generateBundle(_options, bundle) {
        if (this.environment?.name !== 'client') {
          return
        }
        for (const chunk of Object.values(bundle)) {
          if (
            chunk.type === 'chunk' &&
            chunk.moduleIds.some((id) => adminCssId.test(id))
          ) {
            for (const file of chunk.viteMetadata?.importedCss ?? []) {
              adminCssFiles.add(file.slice(file.lastIndexOf('/') + 1))
            }
          }
        }
      },
    })

    if (!options.check || nuxt.options._prepare) {
      return
    }

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
    for (const warning of checkCssSetup(entries, layerRoots)) {
      logger.warn(warning)
    }
  },
})

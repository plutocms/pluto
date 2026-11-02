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
  PLUTO_CSS_IMPORT,
  PLUTO_SITE_CSS_IMPORT,
  renderPlutoAdminCss,
  renderPlutoCss,
  renderPlutoSiteCss,
  resolveRelativeImport,
} from './css-entries'
import { scopeCss } from './scope'

export interface PlutoCssOptions {
  /** Warn at build time about a Tailwind build in a layer, or more than one. Default true. */
  check?: boolean
}

/**
 * The CSS of Pluto. The admin and the site have separate Tailwind builds:
 *
 * - The admin build `#build/pluto-admin.css` (`tailwindcss`, `@nuxt/ui`,
 *   `@plutocms/css`). Tailwind compiles it at the app's build, then the
 *   `pluto-css:scope-admin` plugin scopes every rule to the admin
 *   (`[data-pluto-admin]`, `[data-pluto-admin-scope]`). PlutoAdminTheme imports
 *   it, so it loads only with the admin UI.
 * - The site's build is the app's own CSS entry, if the app has one. A site
 *   needs no Tailwind. A Tailwind site imports what its pages use:
 *
 *     @import 'tailwindcss';
 *     @import '@nuxt/ui';
 *     @import '@plutocms/css';
 *
 * - `@plutocms/css` is an alias of the generated `#build/pluto.css`. It imports
 *   each layer's app/assets/css/pluto-layer.css (the Pluto tokens, the layer
 *   tokens). Nuxt UI already adds `@source` for every layer's app/ dir, so this
 *   file adds no sources.
 * - `@plutocms/css/site` (opt-in) is an alias of `#build/pluto-site.css`: the
 *   Pluto site theme of core (app/assets/css/pluto-site-theme.css), the look of
 *   the Pluto docs for a site.
 * - The names are aliases, not npm packages, so they resolve with every package
 *   manager, also when the app installs only an outer layer.
 * - The module warns about a layer that registers its own Tailwind build, and
 *   about more than one build in the app.
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

    // The opt-in site theme of core. An app that wants the look of the Pluto
    // docs imports `@plutocms/css/site` after `@plutocms/css`.
    const siteTheme = fileURLToPath(
      new URL('../../app/assets/css/pluto-site-theme.css', import.meta.url)
    )
    addTemplate({
      filename: 'pluto-site.css',
      write: true,
      getContents: () => renderPlutoSiteCss(siteTheme, nuxt.options.buildDir),
    })

    // The names that an app's CSS entry imports. Tailwind resolves `@import`
    // through the Vite aliases. `/site` comes first: an alias also matches the
    // paths under its name, so `@plutocms/css` would take `@plutocms/css/site`.
    nuxt.options.alias[PLUTO_SITE_CSS_IMPORT] = join(
      nuxt.options.buildDir,
      'pluto-site.css'
    )
    nuxt.options.alias[PLUTO_CSS_IMPORT] = join(
      nuxt.options.buildDir,
      'pluto.css'
    )

    // The admin build. Not written to disk: on disk, Tailwind IntelliSense
    // could take this entry for the app's design system. Not in `css`:
    // PlutoAdminTheme imports it, so it loads with the admin UI only.
    addTemplate({
      filename: 'pluto-admin.css',
      getContents: renderPlutoAdminCss,
    })

    // Server HTML links the admin build, not inlines it: inline, every page
    // view of a staff user would carry the full build, which no cache keeps.
    const inline = nuxt.options.features.inlineStyles
    if (inline) {
      nuxt.options.features.inlineStyles = (id) =>
        !id?.includes('PlutoAdminTheme.vue') && (inline === true || inline(id))
    }

    // Nuxt prefetches the CSS of every async chunk, so each visitor would
    // download the admin build after the page loads. The plugin below finds
    // the CSS files of the client chunk with the build, and this hook turns
    // off their prefetch. The chunks that render admin UI still load them.
    // The file names, without the assets dir: the manifest keys have none.
    const adminCssFiles = new Set<string>()
    nuxt.hook('build:manifest', (manifest) => {
      for (const file of adminCssFiles) {
        if (manifest[file]) {
          manifest[file].prefetch = false
        }
      }
    })

    // A file path, or a Nuxt virtual id (`virtual:nuxt:…%2Fpluto-admin.css`).
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

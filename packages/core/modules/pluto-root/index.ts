import type { PlutoRootSiteApp } from './inspect'
import { readFileSync } from 'node:fs'
import { relative } from 'node:path'
import {
  addTemplate,
  createResolver,
  defineNuxtModule,
  useLogger,
} from '@nuxt/kit'
import { inspectRootComponent, siteHasOwnApp } from './inspect'

export interface PlutoRootOptions {
  /** Wrap a root component that does not use `PlutoRoot`. Default true. */
  wrap?: boolean
  /**
   * Whether the root of the site renders its own `UApp`. `'auto'` (default) reads the root
   * component. Set it when the `UApp` of the site is in a layout or a component.
   */
  siteApp?: PlutoRootSiteApp
}

/**
 * The root of a Pluto app, with no `PlutoRoot` to write. When the root component (the `app.vue`
 * of the app, of a theme layer such as Docus, or the default one of Nuxt) does not use
 * `PlutoRoot`, the module puts `PlutoAppRoot` in its place, and the template
 * `#build/pluto/site-root.mjs` gives it the original root:
 *
 * - the admin (`/admin/**`) and the preview of the visual editor get `PlutoRoot` and the page
 *   only: the root of the site, its header, layout and awaits never run there;
 * - a public page gets the root of the site, in `PlutoRoot` with `own-layout` (the site root
 *   decides its layout) and `own-app` when the site root has its own `UApp`.
 *
 * A root that uses `PlutoRoot` stays as it is. See the admin-shell skill ("The root").
 */
export default defineNuxtModule<PlutoRootOptions>({
  meta: { name: 'pluto-root', configKey: 'plutoRoot' },
  defaults: { wrap: true, siteApp: 'auto' },
  setup(options, nuxt) {
    const logger = useLogger('pluto-root')
    const { resolve } = createResolver(import.meta.url)

    let siteRoot: string | undefined
    let siteApp = false
    addTemplate({
      filename: 'pluto/site-root.mjs',
      getContents: () =>
        [
          siteRoot
            ? `export { default } from ${JSON.stringify(siteRoot)}`
            : 'export default undefined',
          `export const siteHasApp = ${JSON.stringify(siteApp)}`,
        ].join('\n'),
    })

    if (options.wrap === false) {
      return
    }

    nuxt.hook('app:resolve', (app) => {
      const root = app.mainComponent
      if (!root) {
        return
      }
      let text = ''
      try {
        text = readFileSync(root, 'utf8')
      } catch {
        // A root that cannot be read is wrapped as a plain root.
      }
      const info = inspectRootComponent(text)
      if (info.usesPlutoRoot) {
        return
      }
      siteRoot = root
      siteApp = siteHasOwnApp(info, options.siteApp)
      app.mainComponent = resolve('./runtime/PlutoAppRoot.vue')
      if (nuxt.options.dev && !nuxt.options._prepare) {
        logger.info(
          `The root ${relative(nuxt.options.rootDir, root) || root} has no PlutoRoot, so Pluto wraps it. Its own UApp: ${siteApp ? 'yes' : 'no'}.`
        )
      }
    })
  },
})

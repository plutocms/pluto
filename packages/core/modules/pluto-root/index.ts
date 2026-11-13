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
      } catch {}
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

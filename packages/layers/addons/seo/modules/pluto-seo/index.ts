import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  addServerHandler,
  createResolver,
  defineNuxtModule,
  useLogger,
} from '@nuxt/kit'
import { plutoSeoRoutesToAdd, plutoSeoStaticWarning } from './routes'

/**
 * Adds `/sitemap.xml`, `/robots.txt` and `/feed.xml`. The handlers read the settings
 * (`plutoSeo` in the app config) when they run, because a module cannot read `app.config.ts`
 * at build time. So the routes always exist, unless the app has a file of the same name in
 * `public/`. In a static build they are prerendered, and always answer 200: a feed type that is
 * off gives a valid empty channel. The module imports nothing from core: the static flag is
 * the one that core sets (`runtimeConfig.public.plutoPublicApi.static`).
 */
export default defineNuxtModule({
  meta: { name: 'pluto-seo' },
  setup(_options, nuxt) {
    const logger = useLogger('pluto-seo')
    const { resolve: fromHere } = createResolver(import.meta.url)

    // A `public/` folder of the app or of a layer. The first match wins in Nitro too.
    const publicDirs = nuxt.options._layers.map((layer) =>
      resolve(layer.config.rootDir, layer.config.dir?.public ?? 'public')
    )
    const routes = plutoSeoRoutesToAdd((name) =>
      publicDirs.some((dir) => existsSync(resolve(dir, name)))
    )

    for (const { route, handler } of routes) {
      addServerHandler({
        route,
        method: 'get',
        handler: fromHere(`../../server/handlers/${handler}`),
      })
    }

    // The static flag is set by a module of core, so read it when Nitro starts, after all modules.
    nuxt.hook('nitro:config', (nitroConfig) => {
      const publicConfig = nuxt.options.runtimeConfig.public as {
        plutoPublicApi?: { static?: boolean }
        websiteUrl?: string
      }
      if (publicConfig.plutoPublicApi?.static !== true) {
        return
      }
      nitroConfig.prerender ||= {}
      nitroConfig.prerender.routes = [
        ...(nitroConfig.prerender.routes ?? []),
        ...routes.map(({ route }) => route),
      ]
      const warning = plutoSeoStaticWarning({
        staticBuild: true,
        websiteUrl:
          process.env.NUXT_PUBLIC_WEBSITE_URL || publicConfig.websiteUrl,
      })
      if (warning) {
        logger.warn(warning)
      }
    })
  },
})

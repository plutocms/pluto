import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  addServerHandler,
  createResolver,
  defineNuxtModule,
  useLogger,
} from '@nuxt/kit'
import { plutoSeoRoutesToAdd, plutoSeoStaticWarning } from './routes'

// The handlers read `plutoSeo` when they run, because a module cannot read app.config.ts at build time.
export default defineNuxtModule({
  meta: { name: 'pluto-seo' },
  setup(_options, nuxt) {
    const logger = useLogger('pluto-seo')
    const { resolve: fromHere } = createResolver(import.meta.url)

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

    // Core sets the static flag in its own module, so read it after all modules ran.
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

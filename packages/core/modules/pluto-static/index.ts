import { addServerHandler, createResolver, defineNuxtModule } from '@nuxt/kit'
import { PLUTO_PUBLIC_INDEX_PATH } from '../../shared/utils/public-index'
import {
  isStaticBuild,
  normalizeBasePath,
  withBaseInHeadLinks,
} from './static-build'

export {
  isStaticBuild,
  isStaticPreset,
  normalizeBasePath,
  withBaseInHeadLinks,
} from './static-build'

export default defineNuxtModule({
  meta: { name: 'pluto-static' },
  setup(_options, nuxt) {
    if (!isStaticBuild(nuxt)) {
      return
    }

    const basePath = process.env.PLUTO_BASE_URL?.trim()
    if (basePath) {
      const baseURL = normalizeBasePath(basePath)
      nuxt.options.app.baseURL = baseURL
      nuxt.options.runtimeConfig.app = {
        ...nuxt.options.runtimeConfig.app,
        baseURL,
      }
      const head = nuxt.options.app.head
      if (head?.link) {
        head.link = withBaseInHeadLinks(head.link, baseURL)
      }
    }

    nuxt.options.nitro ||= {}
    nuxt.options.nitro.prerender ||= {}
    nuxt.options.nitro.prerender.ignore = [
      ...(nuxt.options.nitro.prerender.ignore ?? []),
      '/admin',
      '/api/_pluto',
      '/_pluto',
    ]

    const resolver = createResolver(import.meta.url)
    addServerHandler({
      route: PLUTO_PUBLIC_INDEX_PATH,
      method: 'get',
      handler: resolver.resolve('./runtime/public-index.get'),
    })
    nuxt.options.nitro.prerender.routes = [
      ...(nuxt.options.nitro.prerender.routes ?? []),
      PLUTO_PUBLIC_INDEX_PATH,
    ]
    nuxt.options.runtimeConfig.public.plutoPublicApi = {
      ...(nuxt.options.runtimeConfig.public.plutoPublicApi as
        Record<string, unknown> | undefined),
      static: true,
    } as typeof nuxt.options.runtimeConfig.public.plutoPublicApi
  },
})

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

/**
 * A static build (`nuxt generate`, or a static Nitro preset such as `github_pages`), with any
 * backend. The output has no server, so the module:
 *
 * - takes the base path of a project site from `PLUTO_BASE_URL`;
 * - keeps the admin and its routes out of the prerender;
 * - prerenders the public index (`/api/pluto/v1/index.json`), and tells the client
 *   (`public.plutoPublicApi.static`), so the list composables search and page in the browser.
 *
 * A server build gets nothing. See the git-cms skill ("Static build").
 */
export default defineNuxtModule({
  meta: { name: 'pluto-static' },
  setup(_options, nuxt) {
    if (!isStaticBuild(nuxt)) {
      return
    }

    // A project site of GitHub Pages lives under `/<repo>/`. The workflow gives the path in
    // `PLUTO_BASE_URL`, and the module writes it in the build config and the app config.
    // `NUXT_APP_BASE_URL` does not work here: the prerenderer reads it at run time too, the
    // paths then do not match, and every page answers a redirect.
    const basePath = process.env.PLUTO_BASE_URL?.trim()
    if (basePath) {
      const baseURL = normalizeBasePath(basePath)
      nuxt.options.app.baseURL = baseURL
      nuxt.options.runtimeConfig.app = {
        ...nuxt.options.runtimeConfig.app,
        baseURL,
      }
      // Nuxt does not put the base before a link of `app.head`, such as the favicon of
      // the app (`/favicon.svg`).
      const head = nuxt.options.app.head
      if (head?.link) {
        head.link = withBaseInHeadLinks(head.link, baseURL)
      }
    }

    nuxt.options.nitro ||= {}
    nuxt.options.nitro.prerender ||= {}
    // The admin, the API routes of the admin and the preview pages stay out of the output.
    nuxt.options.nitro.prerender.ignore = [
      ...(nuxt.options.nitro.prerender.ignore ?? []),
      '/admin',
      '/api/_pluto',
      '/_pluto',
    ]

    // The public index: the list composables of the browser search and page from this file.
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

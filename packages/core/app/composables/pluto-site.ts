import { computed } from 'vue'
import { absoluteSiteUrl, siteRootUrl } from '../../shared/utils/url'
import { usePlutoSiteInfo } from './pluto-navbar'

/**
 * The site for a public page: `name` (the site info of the backend, else `websiteName`; empty
 * while neither is set), `description` (`websiteDescription`) and `url` (`websiteUrl`, else the site
 * info URL, else the origin of the request). `root` is the root URL for absolute links, with the
 * base path and no trailing slash (`websiteUrl`, else the origin of the request; `''` on a
 * static build without `websiteUrl`), and `absoluteUrl(path)` puts a site path under it (`''`
 * with no root). The site info never sets `root`, so the server and the browser agree.
 *
 * @example
 * const { name, description } = usePlutoSite()
 */
export function usePlutoSite() {
  const info = usePlutoSiteInfo()
  const runtime = useRuntimeConfig()
  const config = runtime.public as {
    websiteName?: string
    websiteDescription?: string
    websiteUrl?: string
    plutoPublicApi?: { static?: boolean }
  }
  const origin = useRequestURL().origin
  const websiteUrl = config.websiteUrl?.trim() ?? ''
  const root = siteRootUrl({
    websiteUrl,
    // A static build has no request at run time: its origin would be the build host.
    origin: websiteUrl || config.plutoPublicApi?.static ? '' : origin,
    baseURL: runtime.app?.baseURL,
  })
  return {
    name: computed(() => {
      const fallback = config.websiteName
      return (
        info.name.value || (fallback && fallback !== 'Untitled' ? fallback : '')
      )
    }),
    description: computed(() => config.websiteDescription ?? ''),
    url: computed(() => websiteUrl || info.url.value || origin),
    root: computed(() => root),
    absoluteUrl: (path: string) => absoluteSiteUrl(path, root),
  }
}

/**
 * The head of every public page, for the layout of the site: the title template
 * (`Post title - Site name`, or the site name alone), `og:site_name`, and the site description
 * as the default `description`. A page that sets its own description (`usePost`, `useSeoMeta`)
 * wins.
 *
 * @example
 * // layouts/default.vue
 * usePlutoSiteHead()
 */
export function usePlutoSiteHead() {
  const site = usePlutoSite()
  useHead({
    titleTemplate: (title?: string) =>
      title && title !== site.name.value
        ? site.name.value
          ? `${title} - ${site.name.value}`
          : title
        : site.name.value || title || '',
  })
  useSeoMeta({
    description: () => site.description.value || undefined,
    ogDescription: () => site.description.value || undefined,
    ogSiteName: () => site.name.value || undefined,
  })
  return site
}

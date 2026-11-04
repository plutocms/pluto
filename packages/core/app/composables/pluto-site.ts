import { computed } from 'vue'
import { usePlutoSiteInfo } from './pluto-navbar'

/**
 * The site for a public page: `name` (the site info of the backend, else `websiteName`; empty
 * while neither is set), `description` (`websiteDescription`) and `url` (the site info URL, else
 * the origin of the request).
 *
 * @example
 * const { name, description } = usePlutoSite()
 */
export function usePlutoSite() {
  const info = usePlutoSiteInfo()
  const config = useRuntimeConfig().public as {
    websiteName?: string
    websiteDescription?: string
  }
  const origin = useRequestURL().origin
  return {
    name: computed(() => {
      const fallback = config.websiteName
      return info.name.value || (fallback && fallback !== 'Untitled' ? fallback : '')
    }),
    description: computed(() => config.websiteDescription ?? ''),
    url: computed(() => info.url.value || origin),
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

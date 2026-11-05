import type { H3Event } from 'h3'
import { getRequestURL } from 'h3'
import { useRuntimeConfig } from 'nitropack/runtime'
import { siteRootUrl } from '../../shared/utils/url'

/**
 * The root URL of the site, for the absolute URLs of a server route (a sitemap, a feed): the
 * origin plus the base path, without a trailing slash (see `siteRootUrl`). The setting
 * `public.websiteUrl` wins. Without it, a server build uses the origin of the request. A static
 * build has no request at run time, so it gives `null`: the route leaves its absolute URLs out.
 *
 * @example
 * const root = getPlutoSiteRoot(event) // 'https://example.com/repo', or null
 */
export function getPlutoSiteRoot(event: H3Event): string | null {
  const config = useRuntimeConfig(event)
  const staticBuild =
    (config.public.plutoPublicApi as { static?: boolean } | undefined)
      ?.static === true
  const websiteUrl = String(config.public.websiteUrl ?? '')
  const root = siteRootUrl({
    websiteUrl,
    origin: websiteUrl || staticBuild ? '' : getRequestURL(event).origin,
    baseURL: config.app.baseURL,
  })
  return root || null
}

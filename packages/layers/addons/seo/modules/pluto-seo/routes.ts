// The routes of the SEO layer, and the rules the module applies to them. Pure code with no Nuxt
// import, so plain Vitest tests it.

export interface PlutoSeoRoute {
  /** The public path of the route. */
  route: string
  /** The handler file in `server/handlers/`, without `.ts`. */
  handler: string
}

/** The three routes. The names are also the file names of `public/`, which win over the routes. */
export const PLUTO_SEO_ROUTES: PlutoSeoRoute[] = [
  { route: '/sitemap.xml', handler: 'sitemap.get' },
  { route: '/robots.txt', handler: 'robots.get' },
  { route: '/feed.xml', handler: 'feed.get' },
]

/**
 * The routes that the module adds. A file with the same name in a `public/` folder of the app (or
 * of a layer) replaces its route: the app keeps a sitemap or a robots.txt that it wrote by hand.
 * `hasPublicFile` gets the name without the leading slash (`sitemap.xml`).
 */
export function plutoSeoRoutesToAdd(
  hasPublicFile: (name: string) => boolean
): PlutoSeoRoute[] {
  return PLUTO_SEO_ROUTES.filter(
    ({ route }) => !hasPublicFile(route.replace(/^\//, ''))
  )
}

/**
 * The warning of a static build with no site URL, or `undefined` when there is nothing to say.
 * A static build has no request at run time, so the sitemap, the feed and the `Sitemap:` line of
 * robots.txt need the site URL to write absolute URLs.
 */
export function plutoSeoStaticWarning(options: {
  staticBuild: boolean
  websiteUrl?: string | null
}): string | undefined {
  if (!options.staticBuild || options.websiteUrl?.trim()) {
    return undefined
  }
  return 'Static build with no site URL: the sitemap and the feed are empty, and pages get no canonical URL. Set NUXT_PUBLIC_WEBSITE_URL (for example https://example.com).'
}

export interface PlutoSeoRoute {
  /** The public path of the route. */
  route: string
  /** The handler file in `server/handlers/`, without `.ts`. */
  handler: string
}

export const PLUTO_SEO_ROUTES: PlutoSeoRoute[] = [
  { route: '/sitemap.xml', handler: 'sitemap.get' },
  { route: '/robots.txt', handler: 'robots.get' },
  { route: '/feed.xml', handler: 'feed.get' },
]

export function plutoSeoRoutesToAdd(
  hasPublicFile: (name: string) => boolean
): PlutoSeoRoute[] {
  return PLUTO_SEO_ROUTES.filter(
    ({ route }) => !hasPublicFile(route.replace(/^\//, ''))
  )
}

export function plutoSeoStaticWarning(options: {
  staticBuild: boolean
  websiteUrl?: string | null
}): string | undefined {
  if (!options.staticBuild || options.websiteUrl?.trim()) {
    return undefined
  }
  return 'Static build with no site URL: the sitemap and the feed are empty, and pages get no canonical URL. Set NUXT_PUBLIC_WEBSITE_URL (for example https://example.com).'
}

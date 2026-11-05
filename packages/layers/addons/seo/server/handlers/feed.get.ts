import { defineEventHandler, setResponseHeader } from 'h3'

// `/feed.xml`. The module adds the route. An RSS 2.0 feed of the newest published items of
// `plutoSeo.feed.type`. Each item has the title, the link, the date and the description only.
// An item that says `seoNoindex` stays out. A type that is missing or private, or a site URL that
// is not known, gives a valid feed with no items, so a static build can prerender the route.
export default defineEventHandler(async (event) => {
  const config = useAppConfig().plutoSeo as PlutoSeoConfig
  const root = getPlutoSiteRoot(event)
  const site = useRuntimeConfig().public as {
    websiteName?: string
    websiteDescription?: string
  }
  const type = getContentType(config.feed.type)

  const items: PlutoSeoFeedItem[] = []
  let lastBuildDate: string | undefined
  if (root && type) {
    const limit = Math.min(
      PLUTO_SEO_FEED_MAX,
      Math.max(1, Math.trunc(Number(config.feed.limit)) || 20)
    )
    const entries = await plutoSeoListEntries(event, type.name, {
      sort: '-publishedAt',
      limit,
      withData: true,
      skipNoindex: true,
    })
    for (const entry of entries) {
      const title = entry.data?.[type.titleField]
      items.push({
        title: typeof title === 'string' ? title : entry.path,
        link: absoluteSiteUrl(entry.path, root),
        pubDate: entry.publishedAt,
        description: plutoSeoDescription(entry.data) ?? '',
      })
    }
    lastBuildDate = entries
      .map((entry) => entry.updatedAt ?? entry.publishedAt)
      .filter((value): value is string => Boolean(value))
      .sort()
      .at(-1)
  }

  const name =
    site.websiteName && site.websiteName !== 'Untitled' ? site.websiteName : ''
  const title = config.feed.title || name || 'Feed'
  setResponseHeader(event, 'Content-Type', 'application/xml; charset=utf-8')
  setPublicApiCache(event)
  return plutoSeoRenderRss(
    {
      title,
      link: root ? `${root}/` : '',
      description: config.feed.description || site.websiteDescription || title,
      language: config.feed.language,
      selfLink: root ? `${root}/feed.xml` : '',
      lastBuildDate,
    },
    items
  )
})

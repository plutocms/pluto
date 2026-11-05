import { defineEventHandler, setResponseHeader } from 'h3'

// `/sitemap.xml`. The module adds the route. The paths of the settings come first, then every
// published item of the public types that have a page. An item that says `seoNoindex` stays out.
// Without a known site URL the sitemap is empty: a sitemap needs absolute URLs.
export default defineEventHandler(async (event) => {
  const config = useAppConfig().plutoSeo as PlutoSeoConfig
  const root = getPlutoSiteRoot(event)

  // The first URL wins. A later one only adds the date it lacks.
  const urls = new Map<string, PlutoSeoSitemapUrl>()
  const add = (loc: string, lastmod?: unknown) => {
    const known = urls.get(loc)
    if (!known) {
      urls.set(loc, { loc, lastmod })
    } else if (known.lastmod === undefined) {
      known.lastmod = lastmod
    }
  }

  if (root) {
    for (const path of config.sitemap.paths) {
      add(absoluteSiteUrl(path, root))
    }
    for (const type of listContentTypes()) {
      if (
        type.api?.public !== true ||
        !type.previewUrl ||
        config.sitemap.exclude[type.name] === true
      ) {
        continue
      }
      const entries = await plutoSeoListEntries(event, type.name, {
        skipNoindex: true,
        limit: PLUTO_SEO_SITEMAP_MAX - urls.size,
      })
      for (const entry of entries) {
        add(
          absoluteSiteUrl(entry.path, root),
          entry.updatedAt ?? entry.publishedAt
        )
      }
    }
  }

  setResponseHeader(event, 'Content-Type', 'application/xml; charset=utf-8')
  setPublicApiCache(event)
  return plutoSeoRenderSitemap([...urls.values()])
})

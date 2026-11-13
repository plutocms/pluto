import { defineEventHandler, setResponseHeader } from 'h3'
export default defineEventHandler(async (event) => {
  const config = useAppConfig().plutoSeo as PlutoSeoConfig
  const root = getPlutoSiteRoot(event)

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

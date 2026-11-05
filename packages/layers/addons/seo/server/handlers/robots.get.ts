import { defineEventHandler, setResponseHeader } from 'h3'

// `/robots.txt`. The module adds the route. It disallows the admin and the API of the admin, and
// names the sitemap when the site URL is known. With `plutoSeo.indexable` false it disallows
// the whole site. A project site (GitHub Pages under `/repo/`) serves it below the root, where
// crawlers do not read it.
export default defineEventHandler((event) => {
  const config = useAppConfig().plutoSeo as PlutoSeoConfig
  const root = getPlutoSiteRoot(event)

  setResponseHeader(event, 'Content-Type', 'text/plain; charset=utf-8')
  setPublicApiCache(event)
  return plutoSeoRenderRobots({
    indexable: config.indexable !== false,
    baseURL: useRuntimeConfig().app.baseURL,
    disallow: config.robots.disallow,
    sitemap: root ? `${root}/sitemap.xml` : '',
  })
})

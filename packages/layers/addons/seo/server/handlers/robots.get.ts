import { defineEventHandler, setResponseHeader } from 'h3'
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

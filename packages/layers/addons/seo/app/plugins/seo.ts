import { defineAsyncComponent } from 'vue'

// The preview of the form loads on demand. Core shows a skeleton while the chunk loads.
const PlutoSeoPreview = defineAsyncComponent(
  () => import('../components/PlutoSeoPreview.vue')
)

// Plugs the layer into core:
// - the SEO fields join the types of `plutoSeo.types` (the server plugin does the same for the
//   routes and the public API),
// - the `seo-preview` widget shows the search and social preview in the form,
// - every item page of `definePlutoContent` (`usePost`, ...) gets the SEO tags,
// - the whole site gets the canonical URL, `og:url`, `twitter:*`, the feed link and the default image.
// Nothing here runs for the admin or the error page. See the seo skill.
export default defineNuxtPlugin(() => {
  const config = useAppConfig().plutoSeo as PlutoSeoConfig

  definePlutoExtension({
    id: 'seo',
    contentTypeExtensions: [plutoSeoTypeExtension(config)],
    contentFieldWidgets: [
      { id: 'seo-preview', widget: 'seo-preview', component: PlutoSeoPreview },
    ],
    contentHead: [
      {
        id: 'seo-item',
        contentType: '*',
        setup: ({ type, item, ogType }) => {
          usePlutoSeo(item, { type, ogType })
        },
      },
    ],
  })

  const router = useRouter()
  const error = useError()
  const site = usePlutoSite()
  const { byName } = usePlutoContentTypes()
  const baseURL = useRuntimeConfig().app.baseURL

  // The tags are plain data. Unhead types each tag by its `rel`, so the cast says it is fine.
  useHead(
    () =>
      plutoSeoSiteHead({
        path: router.currentRoute.value.path,
        page: router.currentRoute.value.query.page as string | undefined,
        error: Boolean(error.value),
        config,
        absoluteUrl: site.absoluteUrl,
        siteName: site.name.value,
        hasFeed: byName(config.feed.type)?.api?.public === true,
        baseURL,
      }) as never
  )
})

import { defineAsyncComponent } from 'vue'

const PlutoSeoPreview = defineAsyncComponent(
  () => import('../components/PlutoSeoPreview.vue')
)

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

  // Unhead types each tag by its `rel`, so the cast is needed.
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

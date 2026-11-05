import type { MaybeRefOrGetter } from 'vue'
import { computed, toValue } from 'vue'

export interface PlutoSeoOptions {
  /** The content type (its `name`, or the type), for the title field and the media fields. */
  type?: string | PlutoContentType
  /** `og:type` of the page. Default `website`. */
  ogType?: 'website' | 'article'
}

/**
 * Sets the SEO tags of an item page: the title, the description, `og:*`, `twitter:*`, the share
 * image with its alt text and size, `noindex` when the item says `seoNoindex`, and the published
 * and modified times of an `article`. It reads the SEO fields first and falls back to the title,
 * the excerpt and the cover. The tags come from `plutoSeoItemHead`. `usePost` and the other
 * `definePlutoContent` pages call it on their own; call it for a page you wrote yourself.
 * Returns what the tags say, as a computed value.
 *
 * @example
 * const { data } = await useFetch(`/api/pluto/v1/content/post/${slug}`)
 * usePlutoSeo(() => data.value?.data, { type: 'post', ogType: 'article' })
 */
export function usePlutoSeo(
  item: MaybeRefOrGetter<Record<string, unknown> | null | undefined>,
  options: PlutoSeoOptions = {}
) {
  const config = useAppConfig().plutoSeo as PlutoSeoConfig
  const { absoluteUrl } = usePlutoSite()
  const { byName } = usePlutoContentTypes()

  const head = computed(() =>
    plutoSeoItemHead(toValue(item), {
      type:
        typeof options.type === 'string' ? byName(options.type) : options.type,
      defaultImage: config.image,
      absoluteUrl,
    })
  )
  const article = options.ogType === 'article'

  useSeoMeta({
    title: () => head.value.title,
    ogTitle: () => head.value.title,
    twitterTitle: () => head.value.title,
    description: () => head.value.description,
    ogDescription: () => head.value.description,
    twitterDescription: () => head.value.description,
    ogImage: () => head.value.image?.url,
    ogImageAlt: () => head.value.image?.alt,
    ogImageWidth: () => head.value.image?.width,
    ogImageHeight: () => head.value.image?.height,
    twitterImage: () => head.value.image?.url,
    twitterImageAlt: () => head.value.image?.alt,
    twitterCard: () => (head.value.image ? 'summary_large_image' : 'summary'),
    ogType: options.ogType ?? 'website',
    robots: () => (head.value.noindex ? 'noindex, follow' : undefined),
    ...(article && {
      articlePublishedTime: () => head.value.publishedTime,
      articleModifiedTime: () => head.value.modifiedTime,
    }),
  })

  return head
}

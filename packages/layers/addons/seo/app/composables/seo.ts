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
 * image with its alt text and size, `noindex` when the item says `seoNoindex`, the authors
 * (`<meta name="author">`), and for an `article` the published and modified times, one
 * `article:author` per author and a JSON-LD `BlogPosting`. It reads the SEO fields first and falls back to the title,
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

  const route = useRoute()

  const head = computed(() =>
    plutoSeoItemHead(toValue(item), {
      type:
        typeof options.type === 'string' ? byName(options.type) : options.type,
      typeOf: byName,
      defaultImage: config.image,
      absoluteUrl,
    })
  )
  const article = options.ogType === 'article'
  const authorNames = computed(
    () =>
      head.value.authors.map((author) => author.name).join(', ') || undefined
  )

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
    author: () => authorNames.value,
    ...(article && {
      articlePublishedTime: () => head.value.publishedTime,
      articleModifiedTime: () => head.value.modifiedTime,
      articleAuthor: () => {
        const list = head.value.authors.map(
          (author) => author.url ?? author.name
        )
        return list.length > 0 ? list : undefined
      },
    }),
  })

  if (article) {
    // The JSON-LD of the article. The text escapes `<`, so no value closes the script.
    useHead({
      script: () => {
        const data = plutoSeoArticleJsonLd(
          head.value,
          absoluteUrl(route.path) || undefined
        )
        return data
          ? [
              {
                key: 'pluto-seo-jsonld',
                type: 'application/ld+json',
                innerHTML: plutoSeoJsonLdText(data),
              },
            ]
          : []
      },
    })
  }

  return head
}

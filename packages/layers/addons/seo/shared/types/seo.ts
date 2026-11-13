/**
 * The settings of the SEO layer (`appConfig.plutoSeo`).
 *
 * @see https://pluto.vulmix.dev/docs/layers/seo#settings
 */
export interface PlutoSeoConfig {
  /** The content types that get the SEO fields, the head tags and a place in the sitemap. Set a type to `false` to turn it off. */
  types: Record<string, boolean>
  /** The default share image for `og:image`: a site path or a full URL. Empty: none. */
  image: string
  /** The `@handle` of the site on X (Twitter), for `twitter:site`. Empty: none. */
  twitterSite: string
  /** False: every page says noindex, and robots.txt disallows the whole site (a staging site). */
  indexable: boolean
  sitemap: {
    /** Site paths that the sitemap lists besides the items of the content types. */
    paths: string[]
    /** A content type name set to `true` leaves that type out of the sitemap. */
    exclude: Record<string, boolean>
  }
  robots: {
    /** Site paths to disallow, besides the admin and the API of the admin. */
    disallow: string[]
  }
  feed: {
    /** The content type of the feed at `/feed.xml`. A type that is not public gives an empty feed. */
    type: string
    /** The channel title. Empty: the name of the site. */
    title: string
    /** The channel description. Empty: the description of the site. */
    description: string
    /** The language code of the channel, for example `pt-BR`. Empty: none. */
    language: string
    /** The most items in the feed (1 to 100). */
    limit: number
  }
}

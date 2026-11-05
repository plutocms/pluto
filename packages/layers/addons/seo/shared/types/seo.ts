/** The settings of the SEO layer (`appConfig.plutoSeo`). See `app/app.config.ts`. */
export interface PlutoSeoConfig {
  types: Record<string, boolean>
  image: string
  twitterSite: string
  indexable: boolean
  sitemap: {
    paths: string[]
    exclude: Record<string, boolean>
  }
  robots: {
    disallow: string[]
  }
  feed: {
    type: string
    title: string
    description: string
    language: string
    limit: number
  }
}

/** The SEO fields that the layer adds to a content type, by field name. */
export interface PlutoSeoFields {
  seoTitle?: string | null
  seoDescription?: string | null
  /** A media id. The public API gives the record of the file. */
  seoImage?: unknown
  seoNoindex?: boolean | null
}

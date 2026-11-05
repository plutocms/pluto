// The settings of the SEO layer. An app changes them in its own app.config.ts; Nuxt merges the
// objects. Lists join the defaults, so an app adds paths (`sitemap.paths`, `robots.disallow`).
// The server routes read the same settings with `useAppConfig()`. See the seo skill.
export default defineAppConfig({
  plutoSeo: {
    // The content types that get the SEO fields, the head tags and a place in the sitemap.
    // Set a type to `false` to turn it off.
    types: { post: true },
    // The default share image for `og:image`: a site path or a full URL. Empty: none.
    image: '',
    // The `@handle` of the site on X (Twitter), for `twitter:site`. Empty: none.
    twitterSite: '',
    // False: every page says noindex, and robots.txt disallows the whole site (a staging site).
    indexable: true,
    sitemap: {
      // Site paths that the sitemap lists besides the items of the content types.
      paths: ['/'],
      // A content type name set to `true` leaves that type out of the sitemap.
      exclude: {} as Record<string, boolean>,
    },
    robots: {
      // Site paths to disallow, besides the admin and the API of the admin.
      disallow: [] as string[],
    },
    feed: {
      // The content type of the feed at `/feed.xml`. A type that is not public gives an empty feed.
      type: 'post',
      // The channel title. Empty: the name of the site.
      title: '',
      // The channel description. Empty: the description of the site.
      description: '',
      // The language code of the channel, for example `pt-BR`. Empty: none.
      language: '',
      // The most items in the feed (1 to 100).
      limit: 20,
    },
  },
})

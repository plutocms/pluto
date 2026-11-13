export default defineAppConfig({
  plutoSeo: {
    types: { post: true },
    image: '',
    twitterSite: '',
    indexable: true,
    sitemap: {
      paths: ['/'],
      exclude: {} as Record<string, boolean>,
    },
    robots: {
      disallow: [] as string[],
    },
    feed: {
      type: 'post',
      title: '',
      description: '',
      language: '',
      limit: 20,
    },
  },
})

# @plutocms/seo

An add-on layer for [Pluto](https://pluto.vulmix.dev) blogs, for every backend (Git CMS or
Supabase), on a server or on a static site:

- **SEO fields:** a post gets an SEO title, an SEO description, a social image and a
  "hide from search engines" switch, with a preview of the search result and the social card in
  the admin.
- **Head tags:** the item pages get the canonical URL, `og:*` and `twitter:*` tags. `usePost` and
  the other content pages need no change.
- **`/sitemap.xml`, `/robots.txt` and `/feed.xml`:** an RSS 2.0 feed of the newest posts.

## Install

```bash
npm install @plutocms/seo
```

Add it next to the backend layer of your app. It does not bring Pluto: the app or the backend
layer does. It needs `@plutocms/core` 0.57.0 or newer.

```ts [nuxt.config.ts]
export default defineNuxtConfig({
  extends: ['@plutocms/core', '@plutocms/seo'],
})
```

Set the address of your site, so the sitemap, the feed and the canonical URL have absolute URLs.
A static site needs it:

```bash
NUXT_PUBLIC_WEBSITE_URL=https://example.com
```

## Where the fields are stored

| Backend  | Where                                                                                                                                       |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Git CMS  | A `seo:` block in the front matter of the post file (`title`, `description`, `image`, `noindex`).                                           |
| Supabase | The columns `seo_title`, `seo_description`, `seo_image` and `seo_noindex` of `posts`. `@plutocms/supabase-blog` adds them in migration 006. |

## Settings

Change them in the `app.config.ts` of your app:

```ts [app/app.config.ts]
export default defineAppConfig({
  plutoSeo: {
    types: { post: true }, // the content types with SEO fields
    image: '/og-default.png', // the default share image
    twitterSite: '@mysite',
    indexable: true, // false: noindex everywhere, and robots.txt disallows all
    sitemap: { paths: ['/', '/about'], exclude: {} },
    robots: { disallow: ['/drafts'] },
    feed: {
      type: 'post',
      title: '',
      description: '',
      language: 'en',
      limit: 20,
    },
  },
})
```

A file with the same name in `public/` replaces a route.

See the [documentation](https://pluto.vulmix.dev/docs/layers/seo) for the full detail.

# Site composables, part 2

The user asked the blog template to use every composable feature (query, SEO meta, site info), and
to add the ideas: drafts on the real post page, `useAdjacentPosts`, `pageLink(n)`, `usePlutoSite()`.

## Checklist

- [x] Public API: `?drafts=1` for an editor (read, else write capability; fails closed; private,
      `meta.draft`), and `GET /api/pluto/v1/surround/<type>/<id>` (up to 1000 published items).
- [x] `usePlutoPublicItem(..., { drafts })`, `usePlutoPublicSurround`, `plutoSurroundApiPath`.
- [x] `useList`: `search` bound to `?q=` (300 ms, back/forward), `pageLink(n)`. `useItem`: drafts
      while the admin bar shows, `draft`. `useSurround`; `useAdjacentPosts` (`newer`, `older`).
- [x] `usePlutoSite`, `usePlutoSiteHead`; `websiteDescription` runtime key.
- [x] Tests (public API, composables, site). Live check in the test app with the template.
- [x] Skills, FEATURES.md, docs (public API), template README.

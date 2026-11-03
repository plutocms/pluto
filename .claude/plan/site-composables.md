# Site composables

The user asked for simpler composables, like Nuxt's: `usePosts` / `usePost`, `useProducts` /
`useProduct`, a factory for any type, the old ones kept for advanced use. `usePost` sets the SEO
tags too (agreed).

## Checklist

- [x] `definePlutoContent(type, defaults)` → `useList` (pages from `?page=`, `items`, `total`,
      `page`, `pages`) and `useItem` (`item`, 404 → error page unless `notFound: 'null'`, SEO tags,
      edit link). `extendPlutoAsyncData` for named keys.
- [x] `usePosts` / `usePost` in core (type `post`, both backends). `PlutoPost`, `PlutoPostSummary`.
- [x] Tests with mocked fetch composables and stubbed auto-imports.
- [x] `useProducts`, `useProduct`, `useProductCategories` in `@plutocms/supabase-shop` (own PR, after
      the core release).
- [x] Skills, FEATURES.md, docs (public API, Git CMS reading, shop layer).
- [ ] Live check in the blog template; the shop template moves later.

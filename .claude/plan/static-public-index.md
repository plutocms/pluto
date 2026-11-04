# Search and pages on a static site

Status: in progress
Started: 2026-11-04
Projects: core (this repo), templates (the demos)
Branch / PR: feat/static-public-index (pluto), templates#3 (the demo)

## Context

- Goal: on a static build of the Git CMS (`nuxt generate`, GitHub Pages), the list composables
  search and page like on a server. Today a search or a page other than the first asks the public
  API, which a static site does not have, and the list shows an error.
- Why now: the live demos of the templates are static builds. A demo is fictional content with
  royalty-free images, and its answers come from a fixed JSON file (user, 2026-11-04). The same
  file fixes every blog on GitHub Pages.
- Decisions:
  - A static build prerenders one file, `/api/pluto/v1/index.json`: per public type, its title
    field and all its published items, in the list shape and in the default sort.
  - The route exists in a static build only (the Git module adds it and prerenders it).
  - `runtimeConfig.public.plutoPublicApi.static` (core, default `false`) tells the client. The Git
    module sets it in a static build.
  - In the browser, with the flag on, `usePlutoPublicList` gives `useFetch` its own `$fetch`: it
    loads the index once and answers from it (`queryPublicIndex`, a pure shared util: the search on
    the title, the `filter[field]` equality, the sort, `limit` and `offset`, the same rules as the
    Git adapter). The server (the prerender) keeps the real API.
  - One item and the surround: no change. Each page is prerendered, so its payload has them.
- Key files: `modules/pluto-github/index.ts` (the static branch),
  `modules/pluto-github/runtime/server/routes/public-index.get.ts`, `app/composables/pluto-public.ts`,
  `shared/utils/public-index.ts`, `nuxt.config.ts` (the flag).

## Checklist

- [x] `queryPublicIndex` and its tests.
- [x] The index route, its prerender, the flag (module test).
- [x] `usePlutoPublicList` answers from the index in a static build.
- [x] Skills (`git-cms`, `content-model`), FEATURES.md.
- [x] Try it: a static build under a sub path, search and page 2 (the blog demo, local core).
- [ ] Docs (static sites).

## Log

- 2026-11-04: planned.
- 2026-11-04: built and checked live on the fictional blog demo (12 posts, 2 pages): next page,
  direct `?page=2`, search, direct `?q=`, no failed request. PR open. Next: docs.

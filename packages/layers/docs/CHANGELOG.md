# Changelog

## [0.20.0](https://github.com/plutocms/pluto/compare/docs-v0.19.0...docs-v0.20.0) (2026-11-02)


### ⚠ BREAKING CHANGES

* an app with no Tailwind entry no longer gets one from Pluto. A site whose pages use Tailwind or Nuxt UI adds its own entry.

### Features

* the admin has its own Tailwind build, and a site needs no Tailwind ([#343](https://github.com/plutocms/pluto/issues/343)) ([6d6ae4a](https://github.com/plutocms/pluto/commit/6d6ae4a59f14289abf2da421d028dba920cacd76))

## [0.19.0](https://github.com/plutocms/pluto/compare/docs-v0.18.0...docs-v0.19.0) (2026-11-01)


### Features

* import the Pluto CSS by name: @plutocms/css and @plutocms/css/site ([#336](https://github.com/plutocms/pluto/issues/336)) ([4d4b404](https://github.com/plutocms/pluto/commit/4d4b404070f186167e020bdcadf4e4df5d0948ef))

## [0.18.0](https://github.com/plutocms/pluto/compare/docs-v0.17.1...docs-v0.18.0) (2026-11-01)


### ⚠ BREAKING CHANGES

* the GitHub CMS is the Git CMS, and plutoLayer returns the source only ([#330](https://github.com/plutocms/pluto/issues/330))

### Features

* the GitHub CMS is the Git CMS, and plutoLayer returns the source only ([#330](https://github.com/plutocms/pluto/issues/330)) ([2aaedfe](https://github.com/plutocms/pluto/commit/2aaedfe32ad25e5e246994a998b0bfab32b63285))

## [0.17.1](https://github.com/plutocms/pluto/compare/docs-v0.17.0...docs-v0.17.1) (2026-10-31)


### Bug Fixes

* **docs:** the repository fields point to the monorepo (npm provenance checks them) ([#325](https://github.com/plutocms/pluto/issues/325)) ([f673859](https://github.com/plutocms/pluto/commit/f673859708ea8a024d5b6f01e966c00e84726004))

## [0.17.0](https://github.com/plutocms/pluto/compare/docs-v0.16.0...docs-v0.17.0) (2026-10-31)


### Features

* @plutocms/docs moves into the monorepo ([f409bdf](https://github.com/plutocms/pluto/commit/f409bdf3f1ded0a1c146e9ad2724ac5222c30c1d))
* @plutocms/docs moves into the monorepo (packages/layers/docs) ([5117e4e](https://github.com/plutocms/pluto/commit/5117e4e507559bd3b8859401665a176e2749cbc5))


### Miscellaneous Chores

* start the release line at 0.1.0 ([36cfc78](https://github.com/plutocms/pluto/commit/36cfc7892ae904e2bc7014da643c1fd3e5b18d1a))

## [0.16.0](https://github.com/plutocms/docs/compare/v0.15.0...v0.16.0) (2026-10-31)


### Features

* block sources and component meta mapping for the editor ([#75](https://github.com/plutocms/docs/issues/75)) ([cc04cf0](https://github.com/plutocms/docs/commit/cc04cf044112b6d4432817711c1e8ed34cce1b7e))
* discover editor blocks from definePlutoBlock in components/content ([#78](https://github.com/plutocms/docs/issues/78)) ([0ce82b9](https://github.com/plutocms/docs/commit/0ce82b9672b276c6b50edf6f647fd42490595c84))

## [0.15.0](https://github.com/plutocms/nuxt-content/compare/v0.14.0...v0.15.0) (2026-10-31)


### ⚠ BREAKING CHANGES

* the package is now @plutocms/docs. The config key plutoNuxtContent is now plutoDocs. The i18n namespace nuxt-content is now docs. The env var PLUTO_NUXT_CONTENT_PATH is not used in this repo.

### Features

* rename the package to @plutocms/docs ([#71](https://github.com/plutocms/nuxt-content/issues/71)) ([b480cfa](https://github.com/plutocms/nuxt-content/commit/b480cfacca3df143ce5844ec26f46679e5ea293b))

## [0.14.0](https://github.com/plutocms/nuxt-content/compare/v0.13.0...v0.14.0) (2026-10-31)


### Features

* the docs types go to the pages nav group, with a navGroup option ([#65](https://github.com/plutocms/nuxt-content/issues/65)) ([8d366e7](https://github.com/plutocms/nuxt-content/commit/8d366e76558d7a9b163aa6c9fca77a9eaa2a9358))

## [0.13.0](https://github.com/plutocms/nuxt-content/compare/v0.12.3...v0.13.0) (2026-10-30)


### ⚠ BREAKING CHANGES

* the layer extends @plutocms/core >=0.38.0, not @plutocms/pluto. PLUTO_PLUTO_PATH is now PLUTO_CORE_PATH.

### Features

* extend @plutocms/core ([#59](https://github.com/plutocms/nuxt-content/issues/59)) ([a5ca2b9](https://github.com/plutocms/nuxt-content/commit/a5ca2b9a1b340d6ceb3d00487414d098c9fae683))

## [0.12.3](https://github.com/plutocms/nuxt-content/compare/v0.12.2...v0.12.3) (2026-10-29)


### Bug Fixes

* **deps:** accept every 0.x version of the [@plutocms](https://github.com/plutocms) packages; shared CI and the update workflow ([#42](https://github.com/plutocms/nuxt-content/issues/42)) ([91b2f58](https://github.com/plutocms/nuxt-content/commit/91b2f58e1f9fa6a47866df6d84e89b59552d9af4))

## [0.12.2](https://github.com/plutocms/nuxt-content/compare/v0.12.1...v0.12.2) (2026-10-29)


### Bug Fixes

* **deps:** use @plutocms/pluto 0.34 ([#40](https://github.com/plutocms/nuxt-content/issues/40)) ([000c153](https://github.com/plutocms/nuxt-content/commit/000c1538d414bc95483a4293f826a747d47820d5))

## [0.12.1](https://github.com/plutocms/nuxt-content/compare/v0.12.0...v0.12.1) (2026-10-29)


### Bug Fixes

* **deps:** use @plutocms/pluto 0.33 ([#38](https://github.com/plutocms/nuxt-content/issues/38)) ([ca54a9f](https://github.com/plutocms/nuxt-content/commit/ca54a9fb8b2bfa8ce5349fbcbd488941413064d6))

## [0.12.0](https://github.com/plutocms/nuxt-content/compare/v0.11.0...v0.12.0) (2026-10-29)


### Features

* **mdc:** use the Markdown code editor of core ([#36](https://github.com/plutocms/nuxt-content/issues/36)) ([b11c355](https://github.com/plutocms/nuxt-content/commit/b11c3550c165373a7080bf4583ceddd4b104d2ae))

## [0.11.0](https://github.com/plutocms/nuxt-content/compare/v0.10.0...v0.11.0) (2026-10-28)


### Features

* **editor:** block list layout, scroll area, preview loading, Markdown footer, canonical classes and Prettier ([#33](https://github.com/plutocms/nuxt-content/issues/33)) ([6743ca9](https://github.com/plutocms/nuxt-content/commit/6743ca98f044641fc4ac8074270efb1b6ce33e75))

## [0.10.0](https://github.com/plutocms/nuxt-content/compare/v0.9.0...v0.10.0) (2026-10-28)


### Features

* **editor:** show the block row controls on hover ([#30](https://github.com/plutocms/nuxt-content/issues/30)) ([5a2faf5](https://github.com/plutocms/nuxt-content/commit/5a2faf56461cc944670931eafea1cbac705623a4))


### Bug Fixes

* **deps:** use @plutocms/pluto 0.29 ([#32](https://github.com/plutocms/nuxt-content/issues/32)) ([423c6db](https://github.com/plutocms/nuxt-content/commit/423c6dba402f67ad8306651e377c5697041d9ddb))

## [0.9.0](https://github.com/plutocms/nuxt-content/compare/v0.8.0...v0.9.0) (2026-10-27)


### ⚠ BREAKING CHANGES

* the layer reads `plutoGithub`, not `plutoCms`. An app that sets `plutoCms` options sets `plutoGithub` now.

### Features

* use the GitHub names of pluto 0.28 ([#28](https://github.com/plutocms/nuxt-content/issues/28)) ([f3f2ee7](https://github.com/plutocms/nuxt-content/commit/f3f2ee7dc08a0f5872eab82fb02e7271cded822f))

## [0.8.0](https://github.com/plutocms/nuxt-content/compare/v0.7.0...v0.8.0) (2026-10-27)


### ⚠ BREAKING CHANGES

* `/api/_pluto/nuxt-content/:type/{page,navigation,surround}` is now `/api/pluto/v1/nuxt-content/:type/{page,navigation,surround}`, and the answer is `{ data }`. A site that uses the composables needs no change.

### Features

* serve the layer routes on the public API of Pluto, and make the docs pages public ([#26](https://github.com/plutocms/nuxt-content/issues/26)) ([9c1ddd9](https://github.com/plutocms/nuxt-content/commit/9c1ddd982d7c24ff22e70337a345a76ddeb63131))

## [0.7.0](https://github.com/plutocms/nuxt-content/compare/v0.6.0...v0.7.0) (2026-10-27)


### ⚠ BREAKING CHANGES

* the default render mode is now 'hybrid'. Content pages must not be prerendered in hybrid or runtime mode. Set `render: 'build'` to keep a fully static site. Needs @plutocms/pluto with `markPublicRead` and `readFile`.

### Features

* render the pages in hybrid mode by default, with build and runtime modes ([#24](https://github.com/plutocms/nuxt-content/issues/24)) ([44efefe](https://github.com/plutocms/nuxt-content/commit/44efefec130c9a48744ec79eba0f454399f5560b))

## [0.6.0](https://github.com/plutocms/nuxt-content/compare/v0.5.0...v0.6.0) (2026-10-27)


### Features

* use the admin bar buttons of core, and shorten the README ([#22](https://github.com/plutocms/nuxt-content/issues/22)) ([568f54b](https://github.com/plutocms/nuxt-content/commit/568f54b3f0a73e0346c44f2aec44e6c34c0320fe))

## [0.5.0](https://github.com/plutocms/nuxt-content/compare/v0.4.1...v0.5.0) (2026-10-26)


### Features

* **deps:** use @plutocms/pluto 0.24 ([#20](https://github.com/plutocms/nuxt-content/issues/20)) ([acb7195](https://github.com/plutocms/nuxt-content/commit/acb71955bdf7f2fb18d545e6281aaef50cc9fc23))

## [0.4.1](https://github.com/plutocms/nuxt-content/compare/v0.4.0...v0.4.1) (2026-10-26)


### Bug Fixes

* **editor:** type the editor for the sites that type-check the layer ([#18](https://github.com/plutocms/nuxt-content/issues/18)) ([c7b08bb](https://github.com/plutocms/nuxt-content/commit/c7b08bbb92e7417487303d599ba42820c0d07059))

## [0.4.0](https://github.com/plutocms/nuxt-content/compare/v0.3.2...v0.4.0) (2026-10-26)


### Features

* add the visual block editor and a hybrid Markdown mode ([#16](https://github.com/plutocms/nuxt-content/issues/16)) ([22c8c5e](https://github.com/plutocms/nuxt-content/commit/22c8c5e7f7f745ced4ef01d85160b08aa5749d7a))

## [0.3.2](https://github.com/plutocms/nuxt-content/compare/v0.3.1...v0.3.2) (2026-10-25)


### Bug Fixes

* **i18n:** use the nuxt-content namespace, so core translates the labels ([#14](https://github.com/plutocms/nuxt-content/issues/14)) ([4c44e3c](https://github.com/plutocms/nuxt-content/commit/4c44e3ce43d8a7d47e9ce0cd20477c41a676ba39))

## [0.3.1](https://github.com/plutocms/nuxt-content/compare/v0.3.0...v0.3.1) (2026-10-25)


### Bug Fixes

* **i18n:** translate the doc type in the admin ([#12](https://github.com/plutocms/nuxt-content/issues/12)) ([2ff7034](https://github.com/plutocms/nuxt-content/commit/2ff70343257ecf912be2e39a94a73a80a9c8aeee))

## [0.3.0](https://github.com/plutocms/nuxt-content/compare/v0.2.0...v0.3.0) (2026-10-25)


### Features

* add New Page and Edit Page to the admin bar ([#9](https://github.com/plutocms/nuxt-content/issues/9)) ([c5fe6ad](https://github.com/plutocms/nuxt-content/commit/c5fe6ad5ebc4a868aacfe8013647b325fc3898a7))

## [0.2.0](https://github.com/plutocms/nuxt-content/compare/v0.1.0...v0.2.0) (2026-10-25)


### Features

* **deps:** use @plutocms/pluto 0.20 and default to no post type ([#6](https://github.com/plutocms/nuxt-content/issues/6)) ([b4fb0f0](https://github.com/plutocms/nuxt-content/commit/b4fb0f044da3411162047503e9ac8ab23df48001))

## 0.1.0 (2026-10-25)


### Features

* add the Nuxt Content layer with a docs preset ([90db635](https://github.com/plutocms/nuxt-content/commit/90db63534eead5ed108d01304eae3092072a44dc))


### Miscellaneous Chores

* start the release line at 0.1.0 ([36cfc78](https://github.com/plutocms/nuxt-content/commit/36cfc7892ae904e2bc7014da643c1fd3e5b18d1a))

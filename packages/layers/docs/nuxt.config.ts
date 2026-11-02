// Point PLUTO_CORE_PATH at a local checkout (e.g. `../pluto/packages/core`) to test
// unpublished changes; unset, it resolves to the published npm package.
const coreLayer = process.env.PLUTO_CORE_PATH || '@plutocms/core'

export default defineNuxtConfig({
  extends: [coreLayer],

  modules: ['@nuxt/content'],

  $meta: {
    name: 'docs',
  },

  // Nuxt Content stores its data in SQLite. The native connector needs Node 22.5
  // or newer and no extra package. An app can set another connector.
  content: {
    experimental: {
      sqliteConnector: 'native',
    },
  },

  // No `css` entry: core builds the admin CSS, the app owns the site's build,
  // and Nuxt UI scans this layer's app/ dir. The tokens of this layer are in
  // app/assets/css/pluto-layer.css. See the single-tailwind-build skill in pluto.

  // The pages are Markdown files, so the fixed blog post type is off. A docs
  // edit must redeploy the site, so the commit message has no `[skip ci]`
  // marker by default. An app can change both. The other `plutoGithub` options
  // have defaults in core (see the git-cms skill in pluto).
  plutoGithub: {
    postType: false,
    commit: {
      skipDeploy: false,
    },
  },
})

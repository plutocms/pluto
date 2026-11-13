// PLUTO_CORE_PATH points at a local core checkout, to test unpublished changes.
const coreLayer = process.env.PLUTO_CORE_PATH || '@plutocms/core'

export default defineNuxtConfig({
  extends: [coreLayer],

  modules: ['@nuxt/content'],

  $meta: {
    name: 'docs',
  },

  content: {
    experimental: {
      sqliteConnector: 'native',
    },
  },

  plutoGithub: {
    postType: false,
    commit: {
      skipDeploy: false,
    },
  },
})

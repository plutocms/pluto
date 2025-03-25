// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({

  modules: [
    '@nuxt/eslint',
    '@nuxt/fonts',
    '@nuxt/icon',
    '@nuxt/ui'
  ],

  // Modules configurations
  fonts: {
    defaults: {
      weights: [400, 600, 700],
    },

    experimental: {
      // Required for TailwindCSS v4.
      processCSSVariables: true,
      disableLocalFallbacks: true,
    },
  },

  // Imports
  components: {
    dirs: [
      {
        path: '~/components',
        pathPrefix: false,
      },
    ],
  },

  css: ['~/assets/css/tailwind.css'],

  // Nuxt configuration
  future: {
    compatibilityVersion: 4,
  },

  experimental: {
    typedPages: true,
  },

  compatibilityDate: '2024-11-01',

  ignore: ['./scripts/**', './supabase/**'],

  devtools: { enabled: true },

})

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  $meta: {
    name: 'pluto',
  },

  modules: [
    '@nuxt/eslint',
    '@nuxt/fonts',
    '@nuxt/icon',
    '@nuxt/ui',
    '@nuxtjs/supabase',
    '@vueuse/nuxt',
    'reka-ui/nuxt',
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

  reka: {
    prefix: 'Reka',
  },

  supabase: {
    cookieName: 'access_token',

    redirectOptions: {
      login: '/login',
      callback: '/confirm',
      exclude: ['/', '/login', '/signup', '/product/*'],
      cookieRedirect: false,
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

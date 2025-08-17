// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: [
    '@nuxt/eslint',
    '@nuxt/fonts',
    '@nuxt/icon',
    '@nuxt/ui',
    '@vueuse/nuxt',
    'reka-ui/nuxt',
    '@nuxtjs/tailwindcss',
  ],

  $meta: {
    name: 'pluto',
  },

  // Imports
  components: {
    dirs: [
      {
        path: './components',
        pathPrefix: false,
      },
    ],
  },

  devtools: { enabled: true },

  routeRules: {
    '/admin': {
      redirect: {
        to: '/admin/home',
      },
    },
    '/admin/**': {
      ssr: false,
    },
  },

  experimental: {
    typedPages: true,
  },

  compatibilityDate: '2025-08-15',

  eslint: {
    config: {
      nuxt: {
        sortConfigKeys: true,
      },
      standalone: false,
    },
  },

  // Modules configurations
  fonts: {
    defaults: {
      weights: [400, 600, 700],
    },
  },

  reka: {
    prefix: 'Reka',
  },
})

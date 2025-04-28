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

  // Modules configurations
  fonts: {
    defaults: {
      weights: [400, 600, 700],
    },
  },

  reka: {
    prefix: 'Reka',
  },

  supabase: {
    cookiePrefix: 'access_token',

    redirectOptions: {
      login: '/admin/login',
      callback: '/auth/confirm',
      exclude: ['/admin/login', '/admin/signup'],
      cookieRedirect: false,
    },
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

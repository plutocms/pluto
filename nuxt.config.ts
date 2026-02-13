const websiteName = process.env.WEBSITE_NAME || 'Untitled'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  extends: ['github:plutocms/utils', './layers/ui'],

  modules: ['@nuxt/eslint', '@vueuse/nuxt'],

  $development: {
    vite: {
      optimizeDeps: {
        include: ['@vue/devtools-core', '@vue/devtools-kit'],
      },
    },
  },

  $meta: {
    name: 'pluto',
  },

  devtools: { enabled: true },

  app: {
    head: {
      titleTemplate: `%s - ${websiteName}`,
    },
  },

  runtimeConfig: {
    public: {
      websiteName,
    },
  },

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

  typescript: {
    includeWorkspace: true,
    typeCheck: false,
  },

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
})

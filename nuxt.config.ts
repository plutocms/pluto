const websiteName = process.env.WEBSITE_NAME || 'Untitled'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  extends: ['layers/shop', 'layers/ui', 'layers/supabase'],

  modules: ['@nuxt/eslint', '@nuxt/fonts', '@nuxt/ui', '@vueuse/nuxt'],

  $development: {
    vite: {
      optimizeDeps: {
        include: [
          '@vue/devtools-core',
          '@vue/devtools-kit',
          'tailwind-merge',
          'reka-ui',
          'change-case',
          'yup',
          '@vueuse/integrations/useChangeCase',
          '@tresjs/cientos',
        ],
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

  css: ['#layers/pluto/app/assets/css/tailwind.css'],

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

  reka: {
    prefix: 'Reka',
  },
})

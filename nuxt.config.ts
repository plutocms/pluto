import tailwindcss from '@tailwindcss/vite'

const websiteName = process.env.WEBSITE_NAME || 'Untitled'

// Point PLUTO_UTILS_PATH at a local checkout (e.g. `../utils`) to test
// unpublished changes; unset, it resolves to the published npm package.
const utilsLayer = process.env.PLUTO_UTILS_PATH || '@plutocms/utils'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  extends: [utilsLayer],

  modules: [
    '@nuxt/eslint',
    '@nuxt/ui',
    '@vueuse/nuxt',
    [
      'reka-ui/nuxt',
      {
        prefix: 'Reka',
      },
    ],
  ],

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

  vite: {
    plugins: [tailwindcss()],
  },

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

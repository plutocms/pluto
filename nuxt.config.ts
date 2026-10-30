const websiteName = process.env.WEBSITE_NAME || 'Untitled'

// Point PLUTO_UTILS_PATH at a local checkout (e.g. `../utils`) to test
// unpublished changes; unset, it resolves to the published npm package.
const utilsLayer = process.env.PLUTO_UTILS_PATH || '@plutocms/utils'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  extends: [utilsLayer],

  modules: [
    '@nuxt/eslint',
    '@nuxt/image',
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
      // The build-time site name. Without WEBSITE_NAME, public titles stay as
      // the page sets them, not "Page - Untitled". The admin builds its own
      // title from the runtime name (PlutoRoot).
      titleTemplate: process.env.WEBSITE_NAME ? `%s - ${websiteName}` : '%s',
    },
  },

  // No `css` entry: the app's CSS entry owns the one Tailwind build, and
  // modules/pluto-css adds this layer's pluto-layer.css to it through
  // #build/pluto.css. See the single-tailwind-build skill.

  runtimeConfig: {
    // Private mail settings. Empty defaults on purpose: Nuxt reads
    // `NUXT_PLUTO_MAIL_*` only for a key that exists here. Set them at run
    // time, never in the build environment. See the mail skill.
    plutoMail: {
      driver: '',
      from: '',
      replyTo: '',
      resend: { apiKey: '' },
      mailpit: { url: '' },
    },
    // The public API (`/api/pluto/v1/**`). `cors`: `true` (any origin), a list of origins, or
    // `false`. `maxAge`: the `s-maxage` of an answer in seconds (`0` = `no-store`). Env:
    // `NUXT_PLUTO_API_CORS` (`false` or a JSON list) and `NUXT_PLUTO_API_MAX_AGE`.
    plutoApi: {
      cors: true,
      maxAge: 60,
    },
    public: {
      websiteName,
      // The media library. A backend sets `driver` (`github`, `supabase`) when it
      // registers its media driver; the admin shows the library only then. Empty
      // `allowedTypes` and `0` give the defaults (shared/utils/media.ts). Env:
      // `NUXT_PUBLIC_PLUTO_MEDIA_MAX_UPLOAD_BYTES`. See the media skill.
      plutoMedia: {
        driver: '',
        allowedTypes: [] as string[],
        maxUploadBytes: 0,
      },
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

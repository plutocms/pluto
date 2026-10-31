const websiteName = process.env.WEBSITE_NAME || 'Untitled'

// https://nuxt.com/docs/api/configuration/nuxt-config
// Core extends no other layer. The helpers of the retired `@plutocms/utils` that
// core uses are in shared/utils (`domainFromUrl`).
export default defineNuxtConfig({
  // No @nuxt/eslint: a module of a layer runs in every app that extends it. The
  // repo lints with @nuxt/eslint-config (eslint.config.mjs at the root).
  modules: [
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
        // Types that layers add (the 3D add-on adds `model/gltf-binary`). Arrays of
        // layers join, so each layer adds its own.
        extraTypes: [] as string[],
        maxUploadBytes: 0,
        // The size limit of single types, in bytes: `{ 'model/gltf-binary': 26214400 }`.
        typeLimits: {} as Record<string, number>,
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
    // No `includeWorkspace`: in the monorepo it would read every package. Each package has its own typecheck.
    includeWorkspace: false,
    typeCheck: false,
  },

  // Modules configurations
  fonts: {
    defaults: {
      weights: [400, 600, 700],
    },
  },

  // Core ships its one brand icon (GitHub) as a tiny custom collection, so it
  // does not depend on the whole simple-icons collection (about 4 MB in the
  // server bundle). Lucide stays a normal installed collection. See the
  // admin-theme skill.
  icon: {
    customCollections: [
      {
        prefix: 'pluto',
        width: 24,
        height: 24,
        icons: {
          github: {
            body: '<path fill="currentColor" d="M12 .297c-6.63 0-12 5.373-12 12c0 5.303 3.438 9.8 8.205 11.385c.6.113.82-.258.82-.577c0-.285-.01-1.04-.015-2.04c-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729c1.205.084 1.838 1.236 1.838 1.236c1.07 1.835 2.809 1.305 3.495.998c.108-.776.417-1.305.76-1.605c-2.665-.3-5.466-1.332-5.466-5.93c0-1.31.465-2.38 1.235-3.22c-.135-.303-.54-1.523.105-3.176c0 0 1.005-.322 3.3 1.23c.96-.267 1.98-.399 3-.405c1.02.006 2.04.138 3 .405c2.28-1.552 3.285-1.23 3.285-1.23c.645 1.653.24 2.873.12 3.176c.765.84 1.23 1.91 1.23 3.22c0 4.61-2.805 5.625-5.475 5.92c.42.36.81 1.096.81 2.22c0 1.606-.015 2.896-.015 3.286c0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/>',
          },
        },
      },
    ],
  },
})

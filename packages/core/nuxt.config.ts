const websiteName = process.env.WEBSITE_NAME || 'Untitled'

const websiteUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : process.env.URL || ''

export default defineNuxtConfig({
  // No @nuxt/eslint: a module of a layer runs in every app that extends it.
  modules: [
    '@nuxt/image',
    '@nuxt/scripts',
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
      // Without WEBSITE_NAME, public titles stay as the page sets them, not "Page - Untitled".
      titleTemplate: process.env.WEBSITE_NAME ? `%s - ${websiteName}` : '%s',
    },
  },

  runtimeConfig: {
    // Empty defaults on purpose: Nuxt reads `NUXT_PLUTO_MAIL_*` only for a key that exists here.
    plutoMail: {
      driver: '',
      from: '',
      replyTo: '',
      resend: { apiKey: '' },
      mailpit: { url: '' },
    },
    plutoApi: {
      cors: true,
      maxAge: 60,
      highlighter: '',
    },
    public: {
      websiteName,
      websiteDescription: '',
      websiteUrl,
      plutoPublicApi: {
        static: false,
      },
      plutoMedia: {
        driver: '',
        allowedTypes: [] as string[],
        // Arrays of layers join, so each layer adds its own types.
        extraTypes: [] as string[],
        maxUploadBytes: 0,
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

  // Nitro 2 runs scheduled tasks on a Node, Bun or Deno server and on Cloudflare, not on Vercel or
  // Netlify. An app turns a task off when it sets its cron key to `[]`.
  nitro: {
    experimental: {
      tasks: true,
    },
    scheduledTasks: {
      '0 3 * * *': ['pluto:trash:purge'],
      '*/5 * * * *': ['pluto:publish:scheduled'],
    },
  },

  // A nested copy of a ProseMirror package makes the editors mix nodes of two copies: the slash
  // menu fails with "multiple versions of prosemirror-model were loaded".
  vite: {
    resolve: {
      dedupe: [
        'prosemirror-model',
        'prosemirror-state',
        'prosemirror-transform',
        'prosemirror-view',
      ],
    },
  },

  typescript: {
    // In the monorepo, `includeWorkspace` would read every package.
    includeWorkspace: false,
    typeCheck: false,
  },

  fonts: {
    defaults: {
      weights: [400, 600, 700],
    },
  },

  // A custom collection keeps the whole simple-icons collection (about 4 MB) out of the server bundle.
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

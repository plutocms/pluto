declare module '@nuxt/schema' {
  interface PublicRuntimeConfig {
    plutoPages: {
      /** The backend registers the page type only when this is true. */
      enabled: boolean
    }
  }
}

export {}

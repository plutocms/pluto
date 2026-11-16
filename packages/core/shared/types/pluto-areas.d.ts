declare module '@nuxt/schema' {
  interface PublicRuntimeConfig {
    plutoAreas: {
      /** The backend registers the area type only when this is true. */
      enabled: boolean
    }
  }
}

export {}

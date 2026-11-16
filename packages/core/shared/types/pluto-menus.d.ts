declare module '@nuxt/schema' {
  interface PublicRuntimeConfig {
    plutoMenus: {
      /** The backend registers the menu type only when this is true. */
      enabled: boolean
    }
  }
}

export {}

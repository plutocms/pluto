declare module '#app' {
  interface PageMeta {
    plutoAdminBar?: boolean
  }
}

declare module 'vue-router' {
  interface RouteMeta {
    plutoAdminBar?: boolean
  }
}

export {}

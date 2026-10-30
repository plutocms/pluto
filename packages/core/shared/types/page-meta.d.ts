// A page can hide the admin bar with `definePageMeta({ plutoAdminBar: false })`.
// See `navbarVisible` in app/composables/internal/admin-shell.ts.
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

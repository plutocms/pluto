import type { PlutoRegistry } from './registry'

// Lives in `shared/` (as a `.d.ts` file) so every generated Nuxt TS project
// (app, server, shared) picks it up automatically, the same way
// `runtime-config.d.ts` augments `@nuxt/schema`'s `RuntimeConfig` in
// `@plutocms/supabase`. `_plutoRegistry` is created lazily per `NuxtApp`
// instance by `usePlutoRegistry` — see `app/composables/pluto-registry.ts`.
declare module '#app' {
  interface NuxtApp {
    _plutoRegistry?: PlutoRegistry
  }
}

export {}

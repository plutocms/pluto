import type { PlutoRegistry } from './registry'

declare module '#app' {
  interface NuxtApp {
    _plutoRegistry?: PlutoRegistry
    /** The capability request in flight, shared by every caller. */
    _plutoPermissionsLoad?: {
      userId: string
      promise: Promise<void>
    }
  }
}

export {}

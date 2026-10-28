import type { PlutoApiConfig } from './pluto-api-options'
import { useRuntimeConfig } from 'nitropack/runtime'
import { resolvePlutoApiConfig } from './pluto-api-options'

/** Only this file reads `useRuntimeConfig`, so a test can replace it. */
export function getPlutoApiConfig(): PlutoApiConfig {
  return resolvePlutoApiConfig(
    (useRuntimeConfig() as Record<string, unknown>).plutoApi
  )
}

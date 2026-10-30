import type {
  PlutoMediaConfig,
  PlutoMediaLimits,
} from '../../shared/types/media'
import { useRuntimeConfig } from 'nitropack/runtime'
import { resolveMediaLimits } from '../../shared/utils/media'

/** The upload rules: `runtimeConfig.public.plutoMedia`, with the defaults. Only this file reads `useRuntimeConfig`, so a test can replace it. */
export function getMediaLimits(): PlutoMediaLimits {
  return resolveMediaLimits(
    (useRuntimeConfig().public as Record<string, unknown>).plutoMedia as
      PlutoMediaConfig | undefined
  )
}

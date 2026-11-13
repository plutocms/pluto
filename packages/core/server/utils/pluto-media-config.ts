import type {
  PlutoMediaConfig,
  PlutoMediaLimits,
} from '../../shared/types/media'
import { useRuntimeConfig } from 'nitropack/runtime'
import { resolveMediaLimits } from '../../shared/utils/media'

export function getMediaLimits(): PlutoMediaLimits {
  return resolveMediaLimits(
    (useRuntimeConfig().public as Record<string, unknown>).plutoMedia as
      PlutoMediaConfig | undefined
  )
}

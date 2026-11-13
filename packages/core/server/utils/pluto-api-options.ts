/**
 * The run-time config of the public API: `runtimeConfig.plutoApi` in `nuxt.config.ts`.
 *
 * @see https://pluto.vulmix.dev/docs/build/public-api#cache-and-cors
 */
export interface PlutoApiConfig {
  /** `true`: any origin (`*`). A list: only these origins. `false`: no CORS header. */
  cors: boolean | string[]
  /** `s-maxage` of a public answer, in seconds. `0` sends `no-store`. */
  maxAge: number
  /**
   * The code highlighter to try first (its `id`, see `definePlutoHighlighter`). Empty: the
   * registered ones by `order`.
   */
  highlighter: string
}

export const PLUTO_API_DEFAULTS: PlutoApiConfig = {
  cors: true,
  maxAge: 60,
  highlighter: '',
}

function corsValue(value: unknown): boolean | string[] {
  if (typeof value === 'boolean') {
    return value
  }
  if (Array.isArray(value)) {
    return value.filter(
      (origin): origin is string => typeof origin === 'string' && origin !== ''
    )
  }
  if (value === 'false') {
    return false
  }
  return PLUTO_API_DEFAULTS.cors
}

/** Makes a clean config from the raw `runtimeConfig.plutoApi`. A bad value uses the default. */
export function resolvePlutoApiConfig(raw: unknown): PlutoApiConfig {
  const value = (raw && typeof raw === 'object' ? raw : {}) as Record<
    string,
    unknown
  >
  const maxAge = Number(value.maxAge)
  return {
    cors:
      value.cors === undefined
        ? PLUTO_API_DEFAULTS.cors
        : corsValue(value.cors),
    maxAge:
      Number.isFinite(maxAge) && maxAge >= 0
        ? Math.trunc(maxAge)
        : PLUTO_API_DEFAULTS.maxAge,
    highlighter:
      typeof value.highlighter === 'string' ? value.highlighter.trim() : '',
  }
}

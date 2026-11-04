import type { Nuxt } from '@nuxt/schema'

/**
 * True for a static build: not dev, and `nuxt generate`, `nitro.static`, or a static Nitro preset
 * (`nitro.preset`, else `NITRO_PRESET`). The output then has no server.
 */
export function isStaticBuild(nuxt: Nuxt): boolean {
  // `_generate` is the internal flag of `nuxt generate`. It is not in the public types.
  const generate = (nuxt.options as { _generate?: boolean })._generate
  return (
    !nuxt.options.dev &&
    (Boolean(generate || nuxt.options.nitro?.static) ||
      isStaticPreset(nuxt.options.nitro?.preset ?? process.env.NITRO_PRESET))
  )
}

/** The Nitro presets that write only static files: `static`, `github_pages`, `*_static`. */
export function isStaticPreset(preset: unknown): boolean {
  if (typeof preset !== 'string') {
    return false
  }
  const name = preset.toLowerCase().replaceAll('-', '_')
  return (
    name === 'static' || name === 'github_pages' || name.endsWith('_static')
  )
}

/** `repo`, `/repo` and `/repo/` become `/repo/`. An empty path becomes `/`. */
export function normalizeBasePath(path: string): string {
  const segments = path.split('/').filter(Boolean)
  return segments.length > 0 ? `/${segments.join('/')}/` : '/'
}

/** The links of `app.head` with a site path (`/favicon.svg`) get the base path in front. */
export function withBaseInHeadLinks<T extends { href?: unknown }>(
  links: T[],
  baseURL: string
): T[] {
  return links.map((link) =>
    typeof link.href === 'string' &&
    link.href.startsWith('/') &&
    !link.href.startsWith('//')
      ? { ...link, href: `${baseURL}${link.href.slice(1)}` }
      : link
  )
}

import type { Nuxt } from '@nuxt/schema'

export function isStaticBuild(nuxt: Nuxt): boolean {
  const generate = (nuxt.options as { _generate?: boolean })._generate
  return (
    !nuxt.options.dev &&
    (Boolean(generate || nuxt.options.nitro?.static) ||
      isStaticPreset(nuxt.options.nitro?.preset ?? process.env.NITRO_PRESET))
  )
}

export function isStaticPreset(preset: unknown): boolean {
  if (typeof preset !== 'string') {
    return false
  }
  const name = preset.toLowerCase().replaceAll('-', '_')
  return (
    name === 'static' || name === 'github_pages' || name.endsWith('_static')
  )
}

export function normalizeBasePath(path: string): string {
  const segments = path.split('/').filter(Boolean)
  return segments.length > 0 ? `/${segments.join('/')}/` : '/'
}

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

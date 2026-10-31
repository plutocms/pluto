const NUMBER_PREFIX = /^\d+\./

/**
 * The public route of a Nuxt Content page, from its content id. Nuxt Content
 * drops the number prefixes of the folders and files, and a final `index`
 * segment. For example `1.getting-started/2.installation` gives
 * `/getting-started/installation`, and `index` gives `/`. `prefix` is added in
 * front of the path (for example `/docs`).
 */
export function contentRoutePath(id: string, prefix = ''): string {
  const segments = String(id)
    .split('/')
    .filter(Boolean)
    .map((segment) => segment.replace(NUMBER_PREFIX, ''))

  if (segments.at(-1) === 'index') {
    segments.pop()
  }

  const base = prefix.split('/').filter(Boolean)
  const path = [...base, ...segments].join('/')
  return `/${path}`
}

/**
 * The admin form of a content item: `/admin/content/<type>/<id>`. Each segment
 * of the id is URL-encoded, and the slashes stay (like `contentIdPath` in core).
 */
export function contentEditPath(type: string, id: string): string {
  const path = String(id)
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/')
  return `/admin/content/${encodeURIComponent(type)}/${path}`
}

/** The admin form that creates an item of a type: `/admin/content/<type>/new`. */
export function contentNewPath(type: string): string {
  return `/admin/content/${encodeURIComponent(type)}/new`
}

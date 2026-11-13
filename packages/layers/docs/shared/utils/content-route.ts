const NUMBER_PREFIX = /^\d+\./

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

export function contentEditPath(type: string, id: string): string {
  const path = String(id)
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/')
  return `/admin/content/${encodeURIComponent(type)}/${path}`
}

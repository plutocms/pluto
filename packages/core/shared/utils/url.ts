export function domainFromUrl(url: string | null | undefined) {
  if (!url) {
    return
  }

  const match = url.match(/^(?:https?:\/\/)?(?:www\.)?([^/]+)/i)
  return match ? match[1] : ''
}

function trimBasePath(baseURL: string | undefined): string {
  const path = (baseURL ?? '').trim().replace(/^\/+|\/+$/g, '')
  return path ? `/${path}` : ''
}

export function siteRootUrl(options: {
  websiteUrl?: string | null
  origin?: string | null
  baseURL?: string | null
}): string {
  const base = trimBasePath(options.baseURL ?? '')
  const source = options.websiteUrl?.trim() || options.origin?.trim() || ''
  let url: URL
  try {
    url = new URL(source)
  } catch {
    return ''
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return ''
  }
  const path = url.pathname.replace(/\/+$/, '')
  const hasBase = !base || path === base || path.endsWith(base)
  return `${url.origin}${path}${hasBase ? '' : base}`
}

export function absoluteSiteUrl(
  pathOrUrl: string,
  root: string | null | undefined
): string {
  const value = pathOrUrl.trim()
  if (/^https?:\/\//i.test(value)) {
    return value
  }
  if (value.startsWith('//')) {
    return `${root?.startsWith('http:') ? 'http:' : 'https:'}${value}`
  }
  if (!root) {
    return ''
  }
  return `${root.replace(/\/+$/, '')}/${value.replace(/^\/+/, '')}`
}

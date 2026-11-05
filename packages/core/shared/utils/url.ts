/**
 * The host of a URL, without the scheme and `www.`: `https://www.example.com/a`
 * gives `example.com`. No URL gives `undefined`; a value that does not parse
 * gives an empty string. The admin bar shows it next to "View site".
 */
export function domainFromUrl(url: string | null | undefined) {
  if (!url) {
    return
  }

  const match = url.match(/^(?:https?:\/\/)?(?:www\.)?([^/]+)/i)
  return match ? match[1] : ''
}

/** A base path as `/repo`: one leading slash, no trailing slash. `/` and nothing give `''`. */
function trimBasePath(baseURL: string | undefined): string {
  const path = (baseURL ?? '').trim().replace(/^\/+|\/+$/g, '')
  return path ? `/${path}` : ''
}

/**
 * The root URL of the site, without a trailing slash: the origin plus the base path, for example
 * `https://example.com/repo`. `websiteUrl` (the setting) wins; it may hold the base path or not,
 * and the base path is added only when the path of `websiteUrl` does not end with it. Without
 * `websiteUrl`, `origin` (the origin of the request) is used. With neither, or with a value
 * that is not an http(s) URL, the answer is `''`: the root is not known.
 *
 * @example
 * siteRootUrl({ websiteUrl: 'https://a.io', baseURL: '/repo/' }) // 'https://a.io/repo'
 * siteRootUrl({ websiteUrl: 'https://a.io/repo', baseURL: '/repo/' }) // 'https://a.io/repo'
 * siteRootUrl({ origin: 'http://localhost:3000', baseURL: '/' }) // 'http://localhost:3000'
 */
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

/**
 * An absolute URL for a site path, under the root of `siteRootUrl`. A full URL stays as it is.
 * `//host/x` takes the scheme of the root (https without one). Do not use
 * `new URL('/x', root)`: it drops the base path of the root. A site path has no base path
 * (`/posts/a`). Without a root, a path gives `''`.
 *
 * @example
 * absoluteSiteUrl('/posts/a', 'https://a.io/repo') // 'https://a.io/repo/posts/a'
 */
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

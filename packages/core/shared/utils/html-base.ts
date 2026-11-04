/**
 * Puts the base path of the app before a site path: `/media/a.png` under `/repo/` gives
 * `/repo/media/a.png`. It changes nothing when the base is `/`, for a URL with a scheme, a
 * protocol-relative URL (`//host`), a relative path, an anchor, a query, and a path that already
 * starts with the base.
 */
export function withBasePath(path: string, baseURL: string): string {
  if (
    !baseURL ||
    baseURL === '/' ||
    !path.startsWith('/') ||
    path.startsWith('//')
  ) {
    return path
  }
  const base = baseURL.endsWith('/') ? baseURL : `${baseURL}/`
  return path.startsWith(base) ? path : `${base}${path.slice(1)}`
}

/**
 * Puts the base path of the app before each site path (`/media/...`, `/posts/...`) in the `src`
 * and `href` attributes of sanitized HTML. A site under a sub path, such as a project site of
 * GitHub Pages (`/<repo>/`), needs it: the body of a post holds plain site paths, and the browser
 * reads them from the root of the host.
 *
 * It changes nothing when the base is `/`, for a URL with a scheme or a protocol-relative URL
 * (`//host`), for a relative path, an anchor or a query, and for a path that already starts with
 * the base. The HTML comes from the public API, so each attribute value is in double quotes.
 */
export function withBaseInHtml(html: string, baseURL: string): string {
  if (!html || !baseURL || baseURL === '/') {
    return html
  }
  return html.replace(
    /(\s(?:src|href)=")(\/[^"]*)"/g,
    (_match, attribute: string, path: string) =>
      `${attribute}${withBasePath(path, baseURL)}"`
  )
}

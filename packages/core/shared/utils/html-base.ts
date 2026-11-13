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

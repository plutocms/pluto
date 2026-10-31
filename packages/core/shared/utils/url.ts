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

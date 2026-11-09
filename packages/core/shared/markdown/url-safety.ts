// The URL and entity checks of the sanitizer, in a file of their own so the component marks
// (`component.ts`) use them too, with no import cycle. Pure: no DOM.

// `data:` images this sanitizer allows in `src`. `data:image/svg+xml` is
// rejected on purpose — an SVG payload can carry a `<script>`.
const SAFE_DATA_IMAGE_PREFIXES = [
  'data:image/png',
  'data:image/jpeg',
  'data:image/gif',
  'data:image/webp',
  'data:image/avif',
]

// Named character references this sanitizer decodes before it checks a
// URL scheme. Keep this list short — it only needs to cover entities an
// attacker could use to hide a scheme such as "javascript:".
const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  quot: '"',
  apos: "'",
  lt: '<',
  gt: '>',
  nbsp: ' ',
  colon: ':',
  NewLine: '\n',
  Tab: '\t',
}

/**
 * Decodes the HTML entities of a text or an attribute value once, as a browser does. A code point
 * out of range stays as it is (`String.fromCodePoint` would throw).
 */
export function decodeEntitiesOnce(value: string): string {
  return value.replace(
    /&(#x[0-9a-f]+|#\d+|[a-z]+);/gi,
    (match, body: string) => {
      if (body[0] === '#') {
        const isHex = body[1] === 'x' || body[1] === 'X'
        const codePoint = Number.parseInt(
          isHex ? body.slice(2) : body.slice(1),
          isHex ? 16 : 10
        )
        return Number.isNaN(codePoint) || codePoint > 0x10ffff
          ? match
          : String.fromCodePoint(codePoint)
      }
      return NAMED_ENTITIES[body] ?? match
    }
  )
}

/**
 * Check if a URL is safe to use in `href` or `src`.
 *
 * ultrahtml keeps attribute values raw. An attacker can hide a scheme
 * behind HTML entities (`java&#115;cript:`) or embedded whitespace
 * (`java&#x09;script:`). This function decodes entities and strips
 * embedded control characters first, then checks the resulting scheme.
 */
export function isSafeUrl(value: string): boolean {
  let decoded = value
  for (let i = 0; i < 5; i += 1) {
    const next = decodeEntitiesOnce(decoded)
    if (next === decoded) {
      break
    }
    decoded = next
  }

  // Browsers ignore tabs, newlines, and other control characters embedded
  // inside a URL scheme, so strip them before the scheme check.
  // eslint-disable-next-line no-control-regex -- intentional: strips every C0 control character before the scheme check
  const stripped = decoded.replace(/[\u0000-\u0020]/g, '').toLowerCase()

  // No scheme at all — a relative path, "#anchor", "?query", and so on.
  // This is always safe.
  if (!/^[a-z][a-z0-9+.-]*:/.test(stripped)) {
    return true
  }

  if (
    stripped.startsWith('http:') ||
    stripped.startsWith('https:') ||
    stripped.startsWith('mailto:')
  ) {
    return true
  }

  return SAFE_DATA_IMAGE_PREFIXES.some((prefix) => stripped.startsWith(prefix))
}

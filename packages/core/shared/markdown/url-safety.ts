// `data:image/svg+xml` is not allowed: an SVG payload can carry a `<script>`.
const SAFE_DATA_IMAGE_PREFIXES = [
  'data:image/png',
  'data:image/jpeg',
  'data:image/gif',
  'data:image/webp',
  'data:image/avif',
]

// Entities that an attacker could use to hide a scheme such as "javascript:".
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
 * Whether a URL is safe in `href` or `src`. It decodes entities and strips control characters
 * first, so a scheme hidden as `java&#115;cript:` or `java&#x09;script:` does not pass.
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

  // eslint-disable-next-line no-control-regex -- intentional: strips every C0 control character before the scheme check
  const stripped = decoded.replace(/[\u0000-\u0020]/g, '').toLowerCase()

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

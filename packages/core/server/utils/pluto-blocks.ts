import type { MarkdownDocument } from 'comark'
import { createHash } from 'node:crypto'
import { parseMarkdown } from 'comark'
import security from 'comark/plugins/security'
import { stripRawTextElements } from '../../shared/utils/blocks/strip-raw-text'

export const PLUTO_BLOCKED_TAGS = [
  'script',
  'style',
  'iframe',
  'frame',
  'frameset',
  'object',
  'embed',
  'base',
  'link',
  'meta',
  'form',
  'input',
  'textarea',
  'select',
  'button',
  'option',
  'noscript',
  'svg',
  'math',
  'audio',
  'video',
  'source',
  'track',
  'canvas',
  'applet',
  'portal',
]

export const PLUTO_ALLOWED_PROTOCOLS = ['http', 'https', 'mailto', 'tel']

export const PLUTO_BLOCKS_CACHE_LIMIT = 200

const cache = new Map<string, MarkdownDocument>()

function keyOf(text: string): string {
  return createHash('sha1').update(text).digest('hex')
}

/**
 * Parses a blocks body (Markdown with components) to a Comark document for the public site. Raw
 * HTML that can run code or load other pages is removed, and so are unsafe URLs. The result is
 * cached by the text.
 *
 * @see https://pluto.vulmix.dev/docs/build/components
 */
export async function parsePlutoBlocks(
  text: string
): Promise<MarkdownDocument> {
  const key = keyOf(text)
  const cached = cache.get(key)
  if (cached) {
    cache.delete(key)
    cache.set(key, cached)
    return cached
  }

  const document = await parseMarkdown(stripRawTextElements(text), {
    autoUnwrap: false,
    plugins: [
      security({
        blockedTags: PLUTO_BLOCKED_TAGS,
        allowedProtocols: PLUTO_ALLOWED_PROTOCOLS,
      }),
    ],
  })

  cache.set(key, document)
  if (cache.size > PLUTO_BLOCKS_CACHE_LIMIT) {
    cache.delete(cache.keys().next().value!)
  }
  return document
}

export function clearPlutoBlocksCache(): void {
  cache.clear()
}

import { sanitizeHighlightHtml } from '../../shared/markdown/sanitize-highlight'
import { decodeEntitiesOnce } from '../../shared/markdown/url-safety'

/**
 * A code highlighter of the public site: it colors the code blocks of the HTML of the public API
 * (a post body). Core has none: with none, a code block stays plain. An add-on layer registers
 * one in a Nitro plugin (`@plutocms/syntax-lowlight`), or the site does (Shiki). See the content-model
 * skill ("Code highlighters").
 */
export interface PlutoHighlighter {
  /** The name to choose it with (`plutoApi.highlighter`): `lowlight`, `shiki`. */
  id: string
  /** Without a choice, the highlighters run by `order` (lowest first). Default 100. */
  order?: number
  /**
   * The HTML of one block: the inside of the `<code>` (spans), or a whole `<pre>` (Shiki). Nothing
   * (`undefined`, `null`, `''`): this highlighter does not know the language, and the next one
   * tries. The text in `code` is plain: the highlighter escapes it. The output goes through an
   * allowlist (`sanitizeHighlightHtml`).
   */
  highlight: (block: {
    code: string
    lang: string
  }) => string | null | undefined | Promise<string | null | undefined>
}

const highlighters = new Map<string, PlutoHighlighter>()

// The highlighted blocks, by the chain, the language and the code. A post that the site serves
// again reuses its blocks. The oldest go first past the limit.
const CACHE_LIMIT = 500
const cache = new Map<string, string>()
const warned = new Set<string>()

/** Registers a code highlighter. The same `id` again replaces it. */
export function definePlutoHighlighter(highlighter: PlutoHighlighter): void {
  highlighters.set(highlighter.id, highlighter)
  cache.clear()
}

/** The registered highlighters, by `order`, then by `id`. */
export function listPlutoHighlighters(): PlutoHighlighter[] {
  return [...highlighters.values()].sort(
    (a, b) => (a.order ?? 100) - (b.order ?? 100) || a.id.localeCompare(b.id)
  )
}

/** For the tests: no highlighter, no cache. */
export function resetPlutoHighlighters(): void {
  highlighters.clear()
  cache.clear()
  warned.clear()
}

/** The highlighters to try, in order: the chosen one first, then the others by `order`. */
export function plutoHighlighterChain(chosen = ''): PlutoHighlighter[] {
  const list = listPlutoHighlighters()
  if (!chosen) {
    return list
  }
  const first = list.find((highlighter) => highlighter.id === chosen)
  if (!first) {
    warnOnce(
      `missing:${chosen}`,
      `[pluto] The code highlighter "${chosen}" (plutoApi.highlighter) is not registered.`
    )
    return list
  }
  return [first, ...list.filter((highlighter) => highlighter !== first)]
}

function warnOnce(key: string, message: string, error?: unknown) {
  if (warned.has(key)) {
    return
  }
  warned.add(key)
  console.warn(message, error ?? '')
}

function remember(key: string, html: string) {
  cache.set(key, html)
  if (cache.size > CACHE_LIMIT) {
    cache.delete(cache.keys().next().value!)
  }
}

// A code block of the sanitized HTML: `<pre><code class="language-ts">…</code></pre>`. The text has
// no `<` (the sanitizer escapes it), so the block ends at its own `</code></pre>`. A block with no
// language stays plain: there is nothing to color it with.
const CODE_BLOCK =
  /<pre><code class="language-([\w+#.-]+)">([\s\S]*?)<\/code><\/pre>/g

async function highlightBlock(
  chain: PlutoHighlighter[],
  lang: string,
  code: string
): Promise<string | null> {
  for (const highlighter of chain) {
    let html: string | null | undefined
    try {
      html = await highlighter.highlight({ code, lang })
    } catch (error) {
      warnOnce(
        `error:${highlighter.id}`,
        `[pluto] The code highlighter "${highlighter.id}" failed.`,
        error
      )
      continue
    }
    if (!html) {
      continue
    }
    const safe = sanitizeHighlightHtml(html).trim()
    if (!safe) {
      continue
    }
    // A whole block (Shiki) keeps its `<pre>`. Spans go into the block of the sanitizer.
    return safe.startsWith('<pre')
      ? safe
      : `<pre><code class="language-${lang}">${safe}</code></pre>`
  }
  return null
}

/**
 * The HTML with its code blocks colored by the highlighters (`chosen` first). With no
 * highlighter, the HTML as it is. A block that no highlighter knows stays plain.
 */
export async function highlightPlutoHtml(
  html: string,
  chosen = ''
): Promise<string> {
  if (
    highlighters.size === 0 ||
    !html.includes('<pre><code class="language-')
  ) {
    return html
  }
  const chain = plutoHighlighterChain(chosen)
  const chainKey = chain.map((highlighter) => highlighter.id).join(',')
  const blocks = [...html.matchAll(CODE_BLOCK)]
  const results = await Promise.all(
    blocks.map(async ([whole, lang = '', escaped = '']) => {
      const code = decodeEntitiesOnce(escaped)
      const key = `${chainKey}\u0000${lang}\u0000${code}`
      const known = cache.get(key)
      if (known !== undefined) {
        return known || whole
      }
      const result = await highlightBlock(chain, lang, code)
      remember(key, result ?? '')
      return result ?? whole
    })
  )
  let index = 0
  return html.replace(CODE_BLOCK, () => results[index++]!)
}

import { toHtml } from 'hast-util-to-html'
import { common, createLowlight } from 'lowlight'

// The `common` grammars of highlight.js (about 35 languages, with their aliases: `ts`, `sh`, `yml`).
const lowlight = createLowlight(common)

/**
 * The spans of one code block (`hljs-*` classes), or `null` for a language that lowlight does not
 * know: the next highlighter of the site tries, or the block stays plain. `toHtml` escapes the
 * text.
 */
export function highlightWithLowlight(block: {
  code: string
  lang: string
}): string | null {
  const lang = block.lang.toLowerCase()
  if (!lang || !lowlight.registered(lang)) {
    return null
  }
  return toHtml(lowlight.highlight(lang, block.code))
}

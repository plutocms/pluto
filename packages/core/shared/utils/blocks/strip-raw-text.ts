const RAW_TEXT_TAGS = [
  'script',
  'style',
  'noscript',
  'iframe',
  'object',
  'embed',
  'textarea',
]

const PATTERN = new RegExp(
  `<(${RAW_TEXT_TAGS.join('|')})\\b[^>]*>[\\s\\S]*?<\\/\\1\\s*>`,
  'gi'
)

/**
 * Removes the raw-text elements that can run code or load pages (`script`, `style`, `iframe`...)
 * with their content. The Markdown parser would keep the text of such a tag inside a block slot.
 * A `template` element is not touched.
 */
export function stripRawTextElements(text: string): string {
  let result = text

  for (let previous = ''; previous !== result;) {
    previous = result
    result = result.replace(PATTERN, '')
  }

  return result
}

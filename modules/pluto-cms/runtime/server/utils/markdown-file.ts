import { parseDocument, stringify } from 'yaml'

export interface MarkdownFile {
  frontmatter: Record<string, unknown>
  body: string
}

// The opening fence, then the shortest block up to the FIRST closing fence.
const FRONTMATTER = /^---[ \t]*\n(?:([\s\S]*?)\n)?---[ \t]*(?:\n|$)/

/**
 * Splits a Markdown file into frontmatter and body. The YAML uses the core
 * schema: no custom tags and no code execution. An unknown tag stays a plain
 * string. A file with no frontmatter gives `{}` and the whole text.
 */
export function parseMarkdownFile(text: string): MarkdownFile {
  const normalized = (text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text).replaceAll('\r\n', '\n').replaceAll('\r', '\n')
  const match = FRONTMATTER.exec(normalized)
  if (!match) {
    return { frontmatter: {}, body: normalized }
  }
  const body = normalized.slice(match[0].length)
  const source = match[1] ?? ''
  const doc = parseDocument(source, { schema: 'core', uniqueKeys: true })
  if (doc.errors.length > 0) {
    throw new Error(`The frontmatter is not valid YAML: ${doc.errors[0]!.message}`)
  }
  const value = doc.toJS({ maxAliasCount: 10 }) as unknown
  if (value === null || value === undefined) {
    return { frontmatter: {}, body }
  }
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('The frontmatter must be a YAML map.')
  }
  return { frontmatter: value as Record<string, unknown>, body }
}

/**
 * Writes frontmatter and body. Keys keep their insertion order. The YAML
 * writer quotes any string that needs it. Empty frontmatter writes no fence.
 */
export function serializeMarkdownFile(frontmatter: Record<string, unknown>, body: string): string {
  const cleanBody = body.replaceAll('\r\n', '\n').replaceAll('\r', '\n')
  const entries = Object.entries(frontmatter).filter(([, value]) => value !== undefined)
  if (entries.length === 0) {
    return cleanBody
  }
  const yaml = stringify(Object.fromEntries(entries), { schema: 'core', lineWidth: 0 })
  return `---\n${yaml}---\n${cleanBody}`
}

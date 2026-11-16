import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { parseDocument, stringify } from 'yaml'

export interface MarkdownFile {
  frontmatter: Record<string, unknown>
  body: string
}

const FRONTMATTER = /^---[ \t]*\n(?:([\s\S]*?)\n)?---[ \t]*(?:\n|$)/

/** The same file format as the Git CMS: YAML frontmatter, then the body. */
export function serializeMarkdownFile(
  frontmatter: Record<string, unknown>,
  body: string
): string {
  const entries = Object.entries(frontmatter).filter(
    ([, value]) => value !== undefined
  )

  if (entries.length === 0) {
    return body
  }

  const yaml = stringify(Object.fromEntries(entries), {
    schema: 'core',
    lineWidth: 0,
  })

  return `---\n${yaml}---\n${body}`
}

export function parseMarkdownFile(source: string): MarkdownFile {
  const normalized = source.replaceAll('\r\n', '\n')
  const match = FRONTMATTER.exec(normalized)

  if (!match) {
    return { frontmatter: {}, body: normalized }
  }

  const document = parseDocument(match[1] ?? '', { schema: 'core' })
  const value = document.errors.length > 0 ? null : (document.toJS() as unknown)

  return {
    frontmatter:
      typeof value === 'object' && value !== null && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : {},
    body: normalized.slice(match[0].length),
  }
}

export async function readIfExists(path: string): Promise<string | undefined> {
  try {
    return await readFile(path, 'utf8')
  } catch {
    return undefined
  }
}

export async function writeFileDeep(
  path: string,
  data: string | Uint8Array
): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, data)
}

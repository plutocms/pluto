import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

export type TypeManifest = Record<string, string>

export type ContentManifest = Record<string, TypeManifest>

const SKIPPED_DIRS = new Set([
  'node_modules',
  '.nuxt',
  '.output',
  '.data',
  '.nitro',
  '.cache',
  'dist',
])
const SEGMENT_PATTERN = /^(?:\d+\.)?[a-z0-9]+(?:-[a-z0-9]+)*$/
const MAX_SEGMENTS = 6
const MAX_ID_LENGTH = 255

export function gitBlobSha(text: string): string {
  const bytes = Buffer.from(text, 'utf8')
  return createHash('sha1')
    .update(`blob ${bytes.length}\0`)
    .update(bytes)
    .digest('hex')
}

// The `github` store reports the Git blob id, and Git keeps LF. Hash a CRLF file with LF, so it does not look changed.
export function versionOf(text: string, storage: string): string {
  return gitBlobSha(storage === 'github' ? text.replace(/\r\n/g, '\n') : text)
}

export function isListedId(
  id: string,
  exclude: readonly string[] = []
): boolean {
  if (id.length === 0 || id.length > MAX_ID_LENGTH) {
    return false
  }
  const segments = id.split('/')
  if (
    segments.length > MAX_SEGMENTS ||
    segments.some((segment) => !SEGMENT_PATTERN.test(segment))
  ) {
    return false
  }
  return !exclude.some((entry) =>
    entry.endsWith('/') ? id.startsWith(entry) : id === entry
  )
}

export interface ManifestFile {
  path: string
  text: string
}

export function buildTypeManifest(
  files: ManifestFile[],
  options: { storage: string; exclude?: readonly string[] }
): TypeManifest {
  const manifest: TypeManifest = {}
  for (const file of [...files].sort((a, b) =>
    a.path < b.path ? -1 : a.path > b.path ? 1 : 0
  )) {
    if (!file.path.endsWith('.md')) {
      continue
    }
    const id = file.path.slice(0, -'.md'.length)
    if (!isListedId(id, options.exclude)) {
      continue
    }
    manifest[id] = versionOf(file.text, options.storage)
  }
  return manifest
}

function walkMarkdown(dir: string, out: string[]): void {
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return
  }
  for (const entry of entries) {
    if (entry.name.startsWith('.')) {
      continue
    }
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (!SKIPPED_DIRS.has(entry.name)) {
        walkMarkdown(full, out)
      }
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      out.push(full)
    }
  }
}

function readTypeFiles(folder: string): ManifestFile[] {
  const found: string[] = []
  walkMarkdown(folder, found)
  return found.map((full) => ({
    path: relative(folder, full).split(sep).join('/'),
    text: readFileSync(full, 'utf8'),
  }))
}

export interface ManifestTypeInput {
  name: string
  source: string
  exclude?: string[]
}

export function buildContentManifest(
  types: ManifestTypeInput[],
  options: { contentDir: string; storage: string }
): ContentManifest {
  const manifest: ContentManifest = {}
  for (const type of types) {
    const folder = type.source
      ? join(options.contentDir, type.source)
      : options.contentDir
    manifest[type.name] = buildTypeManifest(readTypeFiles(folder), {
      storage: options.storage,
      exclude: type.exclude,
    })
  }
  return manifest
}

export function manifestModuleSource(manifest: ContentManifest): string {
  return `export default ${JSON.stringify(manifest)}\n`
}

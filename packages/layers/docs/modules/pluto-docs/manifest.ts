// The build manifest of the hybrid mode. Node code that runs at build time. It lists the
// content files of each type with the version that the content store reports for the file
// (`_version`). At run time the server compares the store with this list to see which pages
// changed after the build. See the docs-setup skill.

import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

/** Content id → version, for one type. */
export type TypeManifest = Record<string, string>

/** Type name → its manifest. */
export type ContentManifest = Record<string, TypeManifest>

/** The same dirs that the CMS fs store skips. */
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

/** The Git blob id of a text: sha1 of `blob <byteLength>\0` and the UTF-8 bytes. Core does the same. */
export function gitBlobSha(text: string): string {
  const bytes = Buffer.from(text, 'utf8')
  return createHash('sha1')
    .update(`blob ${bytes.length}\0`)
    .update(bytes)
    .digest('hex')
}

/**
 * The version of a file text for a storage.
 *
 * - `github`: the store reports the Git blob id. Git keeps LF in the blob, so a CRLF working file
 *   (Windows with `core.autocrlf`) is hashed with LF. A file that really has CRLF in the repository
 *   looks changed at run time. That is safe: the page then comes from the store.
 * - `fs` (and `memory`): the store hashes the file as it is on the disk, so the manifest does too.
 */
export function versionOf(text: string, storage: string): string {
  return gitBlobSha(storage === 'github' ? text.replace(/\r\n/g, '\n') : text)
}

/** Whether a content id is one that the CMS lists: 1 to 6 safe segments, and not excluded. */
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

/** One file in memory: the path is relative to the type folder, with `/`. */
export interface ManifestFile {
  path: string
  text: string
}

/** Builds the manifest of one type from its files. A file that is not a listed `.md` page is skipped. */
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

/** Reads the `.md` files under a type folder on the disk. A missing folder gives `[]`. */
export function readTypeFiles(folder: string): ManifestFile[] {
  const found: string[] = []
  walkMarkdown(folder, found)
  return found.map((full) => ({
    path: relative(folder, full).split(sep).join('/'),
    text: readFileSync(full, 'utf8'),
  }))
}

export interface ManifestTypeInput {
  name: string
  /** The folder under the CMS content dir. `''` is the content dir itself. */
  source: string
  exclude?: string[]
}

/** Builds the manifest of every type. `contentDir` is the absolute path of the CMS content dir. */
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

/** The source of the virtual module that the server imports. */
export function manifestModuleSource(manifest: ContentManifest): string {
  return `export default ${JSON.stringify(manifest)}\n`
}

// The content types of a Nuxt Content site with no `plutoDocs.types`: one type for each page
// collection of the site, from the collections that Nuxt Content resolved (Docus makes them from
// the folders of the site and its locales). Pure code: the module gives the collections, and
// plain Vitest tests it. See the docs-setup skill ("Zero config").

import type { PlutoDocsTypeOptions } from './options'

/** A source of a collection, as Nuxt Content resolves it. Only the keys that the mapper reads. */
export interface ContentCollectionSource {
  include?: string
  prefix?: string
  exclude?: string[]
  repository?: unknown
}

/** A collection, as Nuxt Content resolves it. Only the keys that the mapper reads. */
export interface ContentCollection {
  name: string
  type?: string
  private?: boolean
  source?: ContentCollectionSource[]
}

export interface CollectionTypesResult {
  types: PlutoDocsTypeOptions[]
  /** Why a collection, or a source of one, gives no type. One line each, for the log. */
  skipped: string[]
}

interface FolderSource {
  collection: string
  folder: string
  prefix: string
  exclude: string[]
}

const TYPE_NAME = /^[a-z][a-z0-9-]*$/

/** `docs_en` → `docs-en`. Undefined when the name cannot be a type name. */
function typeName(collection: string): string | undefined {
  const name = collection.toLowerCase().replace(/_+/g, '-').replace(/-+$/, '')
  return TYPE_NAME.test(name) ? name : undefined
}

/** `docs` → `Docs`, `docs-en` → `Docs (en)`. */
function labels(name: string): { label: string; labelPlural: string } {
  const [base = name, ...rest] = name.split('-')
  const suffix = rest.length > 0 ? ` (${rest.join('-')})` : ''
  const plural = base.charAt(0).toUpperCase() + base.slice(1)
  const singular = plural.length > 1 && plural.endsWith('s') ? plural.slice(0, -1) : plural
  return { label: `${singular}${suffix}`, labelPlural: `${plural}${suffix}` }
}

/** The fixed folder of a glob (`docs/**` → `docs`), and whether it reads Markdown pages. */
function globFolder(include: string): { folder: string } | undefined {
  const star = include.indexOf('*')
  const fixed = include.slice(0, star)
  const dynamic = include.slice(star)
  if (!['**', '**/*', '**/*.md', '*.md', '*'].includes(dynamic)) {
    return undefined
  }
  if (fixed !== '' && !fixed.endsWith('/')) {
    return undefined
  }
  return { folder: fixed.replace(/\/+$/, '') }
}

/** The ids and folders of a type, from the exclude globs of its collection (relative to the content dir). */
function excludeIds(excludes: string[], folder: string): string[] {
  const base = folder === '' ? '' : `${folder}/`
  const ids: string[] = []
  for (const glob of excludes) {
    if (base !== '' && !glob.startsWith(base)) {
      continue
    }
    const rel = glob.slice(base.length)
    const dir = /^([^*]+?)\/\*\*(?:\/\*(?:\.md)?)?$/.exec(rel)
    if (dir) {
      ids.push(`${dir[1]}/`)
    } else if (!rel.includes('*') && rel.endsWith('.md')) {
      ids.push(rel.slice(0, -'.md'.length))
    }
  }
  return ids
}

function parentFolder(path: string): string {
  const slash = path.lastIndexOf('/')
  return slash < 0 ? '' : path.slice(0, slash)
}

function isInside(child: string, parent: string): boolean {
  return parent === '' ? child !== '' : child.startsWith(`${parent}/`)
}

/**
 * The docs types of the page collections of a site:
 * - A glob collection (`docs/**`) is a type: its folder is the source, its prefix the route prefix,
 *   its excludes the excluded ids. A type whose folder holds the folder of another type excludes it.
 * - A one-file collection (`index.md`, the landing page of Docus) joins the type of its folder (it
 *   leaves the excludes of that type), or makes a type of its folder that excludes the folders of
 *   the other types.
 * - A data collection, a private one, a remote source (`repository`), and a glob that does not
 *   read Markdown pages give no type.
 */
export function collectionTypes(
  collections: readonly ContentCollection[]
): CollectionTypesResult {
  const skipped: string[] = []
  const folders: FolderSource[] = []
  const files: Array<{ collection: string; file: string; prefix: string }> = []

  for (const collection of collections) {
    if (collection.type !== 'page' || collection.private) {
      continue
    }
    for (const source of collection.source ?? []) {
      const include = source.include ?? ''
      if (source.repository) {
        skipped.push(`${collection.name}: a remote source (${include})`)
        continue
      }
      if (!include.includes('*')) {
        if (include.endsWith('.md')) {
          files.push({
            collection: collection.name,
            file: include,
            prefix: source.prefix ?? '/',
          })
        } else {
          skipped.push(`${collection.name}: not a Markdown page (${include})`)
        }
        continue
      }
      const glob = globFolder(include)
      if (!glob) {
        skipped.push(`${collection.name}: a glob that the docs type cannot read (${include})`)
        continue
      }
      if (folders.some((other) => other.folder === glob.folder)) {
        skipped.push(`${collection.name}: the folder of another collection (${include})`)
        continue
      }
      folders.push({
        collection: collection.name,
        folder: glob.folder,
        prefix: source.prefix ?? (glob.folder === '' ? '/' : `/${glob.folder}`),
        exclude: excludeIds(source.exclude ?? [], glob.folder),
      })
    }
  }

  // One-file collections: in the type of their folder, else a type of their own folder.
  for (const { collection, file, prefix } of files) {
    const folder = parentFolder(file)
    const id = (folder === '' ? file : file.slice(folder.length + 1)).slice(0, -'.md'.length)
    const owner = folders.find((source) => source.folder === folder)
    if (owner) {
      owner.exclude = owner.exclude.filter((excluded) => excluded !== id)
      continue
    }
    // The prefix of a one-file collection is the route of the file: for `index.md` it is the
    // route of its folder, else the folder route is one segment up.
    folders.push({
      collection,
      folder,
      prefix: id === 'index' ? prefix : parentFolder(prefix) || '/',
      exclude: [],
    })
  }

  const types: PlutoDocsTypeOptions[] = []
  for (const source of folders) {
    const name = typeName(source.collection)
    if (!name) {
      skipped.push(`${source.collection}: no type name from this collection name`)
      continue
    }
    if (types.some((type) => type.name === name)) {
      skipped.push(`${source.collection}: the type name "${name}" is taken`)
      continue
    }
    const nested = folders
      .filter((other) => other !== source && isInside(other.folder, source.folder))
      .map((other) => `${other.folder.slice(source.folder === '' ? 0 : source.folder.length + 1)}/`)
    const exclude = [...new Set([...source.exclude, ...nested])]
    types.push({
      preset: 'docs',
      name,
      source: source.folder,
      ...(source.folder === '' ? { label: 'Page', labelPlural: 'Pages' } : labels(name)),
      ...(exclude.length > 0 && { exclude }),
      ...(source.prefix !== '/' && { routePrefix: source.prefix }),
    })
  }
  return { types, skipped }
}

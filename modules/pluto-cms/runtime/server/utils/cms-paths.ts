import { normalizeCmsDir } from '../../../options'

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const MAX_SLUG_LENGTH = 100

export class PlutoCmsPathError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PlutoCmsPathError'
  }
}

/** Throws when the slug is not a lowercase, dash-separated ASCII slug. */
export function assertSafeSlug(slug: string, label = 'slug'): void {
  if (typeof slug !== 'string' || slug.length === 0 || slug.length > MAX_SLUG_LENGTH || !SLUG_PATTERN.test(slug)) {
    throw new PlutoCmsPathError(`The ${label} is not valid.`)
  }
}

/** The file path `<dir>/<source>/<slug>.md`. It always stays under `dir`. */
export function contentFilePath(dir: string, source: string, slug: string): string {
  const base = normalizeCmsDir(dir)
  if (base === undefined) {
    throw new PlutoCmsPathError('The content dir is not valid.')
  }
  assertSafeSlug(source, 'source')
  assertSafeSlug(slug)
  const path = `${base}/${source}/${slug}.md`
  if (!path.startsWith(`${base}/`) || path.slice(base.length + 1).split('/').includes('..')) {
    throw new PlutoCmsPathError('The path leaves the content dir.')
  }
  return path
}

/** The folder `<dir>/<source>` that holds the files of one content type. */
export function contentDirPath(dir: string, source: string): string {
  return contentFilePath(dir, source, 'x').slice(0, -'/x.md'.length)
}

/** Makes a slug from a title. It drops accents. It can return an empty string. */
export function slugifyTitle(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-+$/, '')
}

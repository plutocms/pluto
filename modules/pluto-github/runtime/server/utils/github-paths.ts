import {
  SLUG_MAX_LENGTH,
  slugifyTitle,
} from '../../../../../shared/utils/content-slug'
import { normalizeGithubDir } from '../../../options'

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
/** One segment of a nested id: a slug with an optional numeric prefix (`2.install`). */
const SEGMENT_PATTERN = /^(?:\d+\.)?[a-z0-9]+(?:-[a-z0-9]+)*$/
const MAX_SLUG_LENGTH = SLUG_MAX_LENGTH
const MAX_NESTED_SEGMENTS = 6
const MAX_NESTED_LENGTH = 255

export class PlutoGithubPathError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PlutoGithubPathError'
  }
}

export interface PlutoGithubPathOptions {
  /** The type stores its items in nested folders. See `PlutoContentType.files`. */
  nested?: boolean
}

/** Throws when the slug is not a lowercase, dash-separated ASCII slug. */
export function assertSafeSlug(slug: string, label = 'slug'): void {
  if (
    typeof slug !== 'string' ||
    slug.length === 0 ||
    slug.length > MAX_SLUG_LENGTH ||
    !SLUG_PATTERN.test(slug)
  ) {
    throw new PlutoGithubPathError(`The ${label} is not valid.`)
  }
}

/**
 * Throws when the id is not safe. A flat id follows `assertSafeSlug`. A nested
 * id is 1 to 6 segments joined with `/`, 255 characters at most. Each segment
 * is a slug with an optional numeric prefix. This refuses `..`, an empty
 * segment, a dot segment and a backslash.
 */
export function assertSafeContentId(
  id: string,
  options: PlutoGithubPathOptions = {},
  label = 'slug'
): void {
  if (!options.nested) {
    assertSafeSlug(id, label)
    return
  }
  if (
    typeof id !== 'string' ||
    id.length === 0 ||
    id.length > MAX_NESTED_LENGTH
  ) {
    throw new PlutoGithubPathError(`The ${label} is not valid.`)
  }
  const segments = id.split('/')
  if (
    segments.length > MAX_NESTED_SEGMENTS ||
    segments.some((segment) => !SEGMENT_PATTERN.test(segment))
  ) {
    throw new PlutoGithubPathError(`The ${label} is not valid.`)
  }
}

function baseOf(dir: string): string {
  const base = normalizeGithubDir(dir)
  if (base === undefined) {
    throw new PlutoGithubPathError('The content dir is not valid.')
  }
  return base
}

/**
 * The folder of one content type under `base`. A flat type needs a slug as
 * `source`. A nested type can use `''` (the dir itself) or a nested path.
 */
function typeFolder(
  base: string,
  source: string,
  options: PlutoGithubPathOptions
): string {
  if (options.nested && source === '') {
    return base
  }
  assertSafeContentId(source, options, 'source')
  return `${base}/${source}`
}

/**
 * The file path `<dir>/<source>/<id>.md`. It always stays under `dir`. For a
 * nested type, `id` can hold `/` and `source` can be `''`.
 */
export function contentFilePath(
  dir: string,
  source: string,
  slug: string,
  options: PlutoGithubPathOptions = {}
): string {
  const base = baseOf(dir)
  const folder = typeFolder(base, source, options)
  assertSafeContentId(slug, options)
  const path = `${folder}/${slug}.md`
  if (
    !path.startsWith(`${base}/`) ||
    path
      .slice(base.length + 1)
      .split('/')
      .includes('..')
  ) {
    throw new PlutoGithubPathError('The path leaves the content dir.')
  }
  return path
}

/** The folder `<dir>/<source>` that holds the files of one content type. */
export function contentDirPath(
  dir: string,
  source: string,
  options: PlutoGithubPathOptions = {}
): string {
  return typeFolder(baseOf(dir), source, options)
}

const MAX_RELATIVE_LENGTH = 255
/** True when the text has a control character (code under 32, or 127). */
function hasControlChar(text: string): boolean {
  return [...text].some(
    (char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127
  )
}

/**
 * The path of a raw file under the folder of a type: `<folder>/<relative>`.
 * `relative` is a path inside the folder, with `/` separators. Throws when it
 * is empty, too long, absolute (`/x`, `C:/x`, `C:x`), has a backslash, a control
 * character or a `%` escape, or has an empty, `.` or `..` segment. The result
 * always stays under `folder`.
 */
export function typeRelativePath(folder: string, relative: string): string {
  if (
    typeof relative !== 'string' ||
    relative === '' ||
    relative.length > MAX_RELATIVE_LENGTH ||
    relative.includes('\\') ||
    relative.includes('%') ||
    hasControlChar(relative) ||
    /^[a-z]:/i.test(relative)
  ) {
    throw new PlutoGithubPathError('The path is not valid.')
  }
  const segments = relative.split('/')
  if (
    segments.some(
      (segment) => segment === '' || segment === '.' || segment === '..'
    )
  ) {
    throw new PlutoGithubPathError('The path is not valid.')
  }
  return `${folder}/${relative}`
}

export { slugifyTitle }

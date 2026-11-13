import {
  SLUG_MAX_LENGTH,
  slugifyTitle,
} from '../../../../../shared/utils/content-slug'
import { normalizeGithubDir } from '../../../options'

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
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
  nested?: boolean
}

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

// The result always stays under `dir`: every segment goes through the safe checks.
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

export const TRASH_DIR = '.trash'

export function trashDirPath(dir: string, typeName: string): string {
  assertSafeSlug(typeName, 'type')
  return `${baseOf(dir)}/${TRASH_DIR}/${typeName}`
}

export function trashFilePath(
  dir: string,
  typeName: string,
  id: string,
  options: PlutoGithubPathOptions = {}
): string {
  assertSafeContentId(id, options)
  return `${trashDirPath(dir, typeName)}/${id}.md`
}

export function contentDirPath(
  dir: string,
  source: string,
  options: PlutoGithubPathOptions = {}
): string {
  return typeFolder(baseOf(dir), source, options)
}

const MAX_RELATIVE_LENGTH = 255
function hasControlChar(text: string): boolean {
  return [...text].some(
    (char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127
  )
}

// The result always stays under `folder`: no `..`, no escape.
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

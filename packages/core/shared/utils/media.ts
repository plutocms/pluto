import type {
  PlutoMedia,
  PlutoMediaConfig,
  PlutoMediaLimits,
  PlutoMediaQuery,
  PlutoMediaSort,
} from '../types/media'
import { slugifyTitle } from './content-slug'

/**
 * The file types an upload can have, when the app sets none. SVG is not in it:
 * it can hold scripts. A layer adds its types with `extraTypes` (the 3D add-on
 * adds `model/gltf-binary`).
 */
export const PLUTO_MEDIA_DEFAULT_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
  'image/gif',
  'application/pdf',
]

/** The largest preview image of a file, in bytes. */
export const PLUTO_MEDIA_MAX_PREVIEW_BYTES = 2 * 1024 * 1024

export const PLUTO_MEDIA_SORTS: readonly PlutoMediaSort[] = [
  'newest',
  'oldest',
  'name',
  'size',
]

export const PLUTO_MEDIA_DEFAULT_MAX_BYTES = 10 * 1024 * 1024

/** The longest edge of an image after the browser processes it, in pixels. */
export const PLUTO_MEDIA_MAX_IMAGE_EDGE = 2400

/** The most records one list call returns. */
export const PLUTO_MEDIA_MAX_LIMIT = 100

const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'image/gif': 'gif',
  'model/gltf-binary': 'glb',
  'application/pdf': 'pdf',
}

/**
 * The upload rules of the app: the types of the app (or the defaults) plus the
 * `extraTypes` of the layers, the size limit, and the limits of single types.
 */
export function resolveMediaLimits(
  config?: PlutoMediaConfig | null
): PlutoMediaLimits {
  const base = config?.allowedTypes?.length
    ? config.allowedTypes
    : PLUTO_MEDIA_DEFAULT_TYPES
  const typeLimits: Record<string, number> = {}
  for (const [type, bytes] of Object.entries(config?.typeLimits ?? {})) {
    if (Number(bytes) > 0) {
      typeLimits[type] = Number(bytes)
    }
  }
  return {
    allowedTypes: [...new Set([...base, ...(config?.extraTypes ?? [])])],
    maxUploadBytes:
      config?.maxUploadBytes && config.maxUploadBytes > 0
        ? config.maxUploadBytes
        : PLUTO_MEDIA_DEFAULT_MAX_BYTES,
    typeLimits,
  }
}

/** The size limit of one type: its own limit, else `maxUploadBytes`. */
export function mediaMaxBytes(
  limits: PlutoMediaLimits,
  mimeType: string
): number {
  return limits.typeLimits[mimeType] ?? limits.maxUploadBytes
}

/** The largest file of any allowed type. */
export function mediaLargestLimit(limits: PlutoMediaLimits): number {
  return Math.max(limits.maxUploadBytes, ...Object.values(limits.typeLimits))
}

/**
 * True when `mimeType` matches one of `patterns`: an exact type, a family
 * (`image/*`), or a prefix that ends with `/` (`model/`). No patterns match everything.
 */
export function matchesMediaType(
  mimeType: string,
  patterns: readonly string[] | undefined
): boolean {
  if (!patterns || patterns.length === 0) {
    return true
  }
  const type = mimeType.toLowerCase()
  return patterns.some((pattern) => {
    const value = pattern.trim().toLowerCase()
    if (value === '*' || value === '*/*') {
      return true
    }
    if (value.endsWith('/*')) {
      return type.startsWith(value.slice(0, -1))
    }
    if (value.endsWith('/')) {
      return type.startsWith(value)
    }
    return type === value
  })
}

/** The family of a file, for icons and filters. */
export function mediaKind(
  mimeType: string
): 'image' | 'model' | 'document' | 'file' {
  if (mimeType.startsWith('image/')) {
    return 'image'
  }
  if (mimeType.startsWith('model/')) {
    return 'model'
  }
  if (mimeType === 'application/pdf') {
    return 'document'
  }
  return 'file'
}

/** True for an image record. */
export function isMediaImage(media: Pick<PlutoMedia, 'mimeType'>): boolean {
  return mediaKind(media.mimeType) === 'image'
}

/**
 * The type of a file from its name, for a file that the browser gives no type
 * (a `.glb` model, often). Empty for an unknown extension. The server reads
 * the real type from the bytes.
 */
export function mediaTypeFromName(name: string): string {
  const extension = name.slice(name.lastIndexOf('.') + 1).toLowerCase()
  if (extension === 'jpeg') {
    return 'image/jpeg'
  }
  return (
    Object.entries(EXTENSIONS).find(([, value]) => value === extension)?.[0] ??
    ''
  )
}

/** The `accept` of a file input: the types, and the extensions of the known types. */
export function mediaAcceptAttribute(types: readonly string[]): string {
  const extensions = Object.entries(EXTENSIONS)
    .filter(([type]) => matchesMediaType(type, types))
    .map(([, extension]) => `.${extension}`)
  return [...types, ...extensions].join(',')
}

/** The file extension of a MIME type, without the dot. */
export function mediaExtension(mimeType: string): string {
  return EXTENSIONS[mimeType] ?? 'bin'
}

/** The file name of the preview of a stored file: `mug-k3j9a.glb` gives `mug-k3j9a.preview.webp`. */
export function mediaPreviewFileName(
  fileName: string,
  mimeType: string
): string {
  return `${fileName.replace(/.[^.]+$/, '')}.preview.${mediaExtension(mimeType)}`
}

/**
 * The stored file name: the slug of the name (without its extension), the
 * suffix, and the extension of the real type. Example: "Pão de Mel.JPG",
 * `image/webp`, "k3j9" gives "pao-de-mel-k3j9.webp".
 */
export function mediaFileName(
  name: string,
  mimeType: string,
  suffix: string
): string {
  const stem = slugifyTitle(name.replace(/\.[^./\\]+$/, '')).slice(0, 60)
  return `${stem || 'file'}-${suffix}.${mediaExtension(mimeType)}`
}

/**
 * The page of `records` that a query asks for: the search, the type filter,
 * newest first. For a driver that reads all its records at once (GitHub, a test).
 */
export function filterMediaRecords(
  records: PlutoMedia[],
  query: PlutoMediaQuery
): {
  data: PlutoMedia[]
  total: number
} {
  const search = query.search?.trim().toLowerCase()
  const type = query.type === 'image' ? 'image/*' : query.type
  const matching = records
    .filter(
      (record) =>
        (!search ||
          record.name.toLowerCase().includes(search) ||
          record.alt.toLowerCase().includes(search)) &&
        (!type || matchesMediaType(record.mimeType, [type]))
    )
    .sort(mediaComparator(query.sort))
  return {
    data: matching.slice(query.offset, query.offset + query.limit),
    total: matching.length,
  }
}

/** The order of `sort`, for a driver that sorts in memory. */
export function mediaComparator(
  sort: PlutoMediaSort = 'newest'
): (a: PlutoMedia, b: PlutoMedia) => number {
  switch (sort) {
    case 'oldest':
      return (a, b) =>
        a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0
    case 'name':
      return (a, b) =>
        a.name.localeCompare(b.name, undefined, {
          sensitivity: 'base',
          numeric: true,
        })
    case 'size':
      return (a, b) => b.size - a.size
    default:
      return (a, b) =>
        a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0
  }
}

/** The ids that a `media` field value holds: one id, a list, or nothing. */
export function mediaFieldIds(value: unknown): string[] {
  const list = Array.isArray(value) ? value : [value]
  return list
    .filter(
      (entry) =>
        (typeof entry === 'string' && entry !== '') ||
        (typeof entry === 'number' && Number.isFinite(entry))
    )
    .map(String)
}

/** A size for people: "820 KB", "2.4 MB". */
export function formatMediaSize(bytes: number, locale?: string): string {
  const units = ['B', 'KB', 'MB', 'GB']
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit++
  }
  const digits = unit === 0 || value >= 10 ? 0 : 1
  return `${value.toLocaleString(locale, { maximumFractionDigits: digits })} ${units[unit]}`
}

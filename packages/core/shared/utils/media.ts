import type {
  PlutoMedia,
  PlutoMediaConfig,
  PlutoMediaLimits,
  PlutoMediaQuery,
  PlutoMediaSort,
} from '../types/media'
import { slugifyTitle } from './content-slug'

const PLUTO_MEDIA_DEFAULT_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
  'image/gif',
  'application/pdf',
]

export const PLUTO_MEDIA_MAX_PREVIEW_BYTES = 2 * 1024 * 1024

export const PLUTO_MEDIA_SORTS: readonly PlutoMediaSort[] = [
  'newest',
  'oldest',
  'name',
  'size',
]

const PLUTO_MEDIA_DEFAULT_MAX_BYTES = 10 * 1024 * 1024

export const PLUTO_MEDIA_MAX_IMAGE_EDGE = 2400

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

export function mediaMaxBytes(
  limits: PlutoMediaLimits,
  mimeType: string
): number {
  return limits.typeLimits[mimeType] ?? limits.maxUploadBytes
}

export function mediaLargestLimit(limits: PlutoMediaLimits): number {
  return Math.max(limits.maxUploadBytes, ...Object.values(limits.typeLimits))
}

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

function mediaKind(mimeType: string): 'image' | 'model' | 'document' | 'file' {
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

export function mediaAcceptAttribute(types: readonly string[]): string {
  const extensions = Object.entries(EXTENSIONS)
    .filter(([type]) => matchesMediaType(type, types))
    .map(([, extension]) => `.${extension}`)
  return [...types, ...extensions].join(',')
}

function mediaExtension(mimeType: string): string {
  return EXTENSIONS[mimeType] ?? 'bin'
}

export function mediaPreviewFileName(
  fileName: string,
  mimeType: string
): string {
  return `${fileName.replace(/.[^.]+$/, '')}.preview.${mediaExtension(mimeType)}`
}

export function mediaFileName(
  name: string,
  mimeType: string,
  suffix: string
): string {
  const stem = slugifyTitle(name.replace(/\.[^./\\]+$/, '')).slice(0, 60)
  return `${stem || 'file'}-${suffix}.${mediaExtension(mimeType)}`
}

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

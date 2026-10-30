import type { H3Event } from 'h3'
import type {
  PlutoMedia,
  PlutoMediaLimits,
  PlutoMediaPatch,
  PlutoMediaPreviewUpload,
  PlutoMediaQuery,
  PlutoMediaSort,
  PlutoMediaUpload,
} from '../../shared/types/media'
import { getQuery, getRequestURL, readBody, readMultipartFormData } from 'h3'
import {
  formatMediaSize,
  matchesMediaType,
  mediaFileName,
  mediaLargestLimit,
  mediaMaxBytes,
  mediaPreviewFileName,
  PLUTO_MEDIA_MAX_LIMIT,
  PLUTO_MEDIA_MAX_PREVIEW_BYTES,
  PLUTO_MEDIA_SORTS,
} from '../../shared/utils/media'
import { createPlutoError } from './pluto-error'
import {
  readImageSize,
  sniffMediaType,
  stripImageMetadata,
} from './pluto-media-bytes'
import { getMediaLimits } from './pluto-media-config'
import { requireMediaDriver } from './pluto-media-driver'

// The media library of core: the upload checks and the route handlers. A
// backend registers one driver (pluto-media-driver.ts). Core owns the routes,
// the checks and the record: the driver only stores the bytes and the
// record. See the media skill.

/** Five random characters, `[a-z0-9]`. They make a stored file name unique. */
export function mediaSuffix(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(5))
  return [...bytes].map((byte) => (byte % 36).toString(36)).join('')
}

export interface MediaFileInput {
  name: string
  data: Uint8Array
  alt?: string
  /** The bytes of a preview image, made in the browser. */
  preview?: Uint8Array
}

/**
 * Checks an uploaded file and makes its complete record: the real type (from
 * the bytes), the size limit, the metadata removed, the pixel size, the
 * stored file name. Throws 400, 413 or 415.
 */
export function prepareMediaUpload(
  file: MediaFileInput,
  limits: PlutoMediaLimits,
  now: Date = new Date(),
  suffix: string = mediaSuffix()
): PlutoMediaUpload {
  const name = file.name.trim().slice(0, 200) || 'file'
  if (file.data.length === 0) {
    throw createPlutoError({
      statusCode: 400,
      message: 'The file is empty.',
      key: 'pluto.media.errors.empty',
      params: { name },
    })
  }
  const tooLarge = (limit: number) =>
    createPlutoError({
      statusCode: 413,
      message: 'The file is too large.',
      key: 'pluto.media.errors.tooLarge',
      params: { name, limit: formatMediaSize(limit) },
    })
  // A file over every limit stops before the type check reads it.
  if (file.data.length > mediaLargestLimit(limits)) {
    throw tooLarge(mediaLargestLimit(limits))
  }
  const mimeType = sniffMediaType(file.data)
  if (!mimeType || !matchesMediaType(mimeType, limits.allowedTypes)) {
    throw createPlutoError({
      statusCode: 415,
      message: 'This file type is not allowed.',
      key: 'pluto.media.errors.typeNotAllowed',
      params: { name },
    })
  }
  if (file.data.length > mediaMaxBytes(limits, mimeType)) {
    throw tooLarge(mediaMaxBytes(limits, mimeType))
  }
  const data = stripImageMetadata(file.data, mimeType)
  const size = mimeType.startsWith('image/') ? readImageSize(data) : null
  const fileName = mediaFileName(name, mimeType, suffix)
  return {
    fileName,
    name,
    data,
    mimeType,
    size: data.length,
    width: size?.width ?? null,
    height: size?.height ?? null,
    alt: (file.alt ?? '').trim().slice(0, 500),
    createdAt: now.toISOString(),
    preview: file.preview ? prepareMediaPreview(file.preview, fileName) : null,
  }
}

/**
 * Checks the preview image of a file (made in the browser by the kind of the
 * file): a JPEG, PNG or WebP image, at most 2 MB, with its pixel size. The
 * metadata goes, like for any image. Throws 413 or 415.
 */
export function prepareMediaPreview(
  data: Uint8Array,
  fileName: string
): PlutoMediaPreviewUpload {
  if (data.length > PLUTO_MEDIA_MAX_PREVIEW_BYTES) {
    throw createPlutoError({
      statusCode: 413,
      message: 'The preview is too large.',
      key: 'pluto.media.errors.previewTooLarge',
      params: { limit: formatMediaSize(PLUTO_MEDIA_MAX_PREVIEW_BYTES) },
    })
  }
  const mimeType = sniffMediaType(data)
  const clean =
    mimeType && ['image/webp', 'image/jpeg', 'image/png'].includes(mimeType)
      ? stripImageMetadata(data, mimeType)
      : null
  const size = clean ? readImageSize(clean) : null
  if (!mimeType || !clean || !size) {
    throw createPlutoError({
      statusCode: 415,
      message: 'The preview must be a JPEG, PNG or WebP image.',
      key: 'pluto.media.errors.badPreview',
    })
  }
  return {
    fileName: mediaPreviewFileName(fileName, mimeType),
    data: clean,
    mimeType,
    width: size.width,
    height: size.height,
  }
}

function text(value: unknown, max: number): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value
  if (typeof raw !== 'string') {
    return undefined
  }
  const trimmed = raw.trim()
  return trimmed ? trimmed.slice(0, max) : undefined
}

function whole(value: unknown, fallback: number): number {
  const number = Number(Array.isArray(value) ? value[0] : value)
  return Number.isInteger(number) && number >= 0 ? number : fallback
}

/** The list query of `GET /api/_pluto/media`. */
export function parseMediaQuery(raw: Record<string, unknown>): PlutoMediaQuery {
  return {
    limit: Math.min(PLUTO_MEDIA_MAX_LIMIT, Math.max(1, whole(raw.limit, 40))),
    offset: whole(raw.offset, 0),
    search: text(raw.search, 100),
    type: text(raw.type, 60),
    sort: PLUTO_MEDIA_SORTS.find((sort) => sort === text(raw.sort, 10)) as
      PlutoMediaSort | undefined,
  }
}

/** `GET /api/_pluto/media`: a page of the library, or the records of `ids`. */
export async function listMedia(event: H3Event): Promise<{
  data: PlutoMedia[]
  total: number
}> {
  const driver = requireMediaDriver()
  await driver.authorize(event, 'media:manage')
  const raw = getQuery(event)
  const ids = text(raw.ids, 4000)
  if (ids) {
    const wanted = ids
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean)
      .slice(0, PLUTO_MEDIA_MAX_LIMIT)
    const data = await driver.get(event, wanted)
    return { data, total: data.length }
  }
  return driver.list(event, parseMediaQuery(raw))
}

/** `POST /api/_pluto/media`: multipart, with a `file` part, and optional `alt` and `preview` parts. */
export async function uploadMedia(
  event: H3Event
): Promise<{ data: PlutoMedia }> {
  const driver = requireMediaDriver()
  await driver.authorize(event, 'media:manage')
  const parts = (await readMultipartFormData(event)) ?? []
  const file =
    parts.find((part) => part.name === 'file' && part.filename) ??
    parts.find((part) => part.filename && part.name !== 'preview')
  const preview = parts.find((part) => part.name === 'preview')
  if (!file?.filename) {
    throw createPlutoError({
      statusCode: 400,
      message: 'No file sent.',
      key: 'pluto.media.errors.noFile',
    })
  }
  const alt = parts.find((part) => part.name === 'alt' && !part.filename)
  const upload = prepareMediaUpload(
    {
      name: file.filename,
      data: new Uint8Array(file.data),
      alt: alt ? new TextDecoder().decode(alt.data) : undefined,
      preview: preview?.data.length ? new Uint8Array(preview.data) : undefined,
    },
    getMediaLimits()
  )
  return { data: await driver.upload(event, upload) }
}

/** `PATCH /api/_pluto/media/:id`: `{ alt?, name? }`. */
export async function updateMedia(
  event: H3Event,
  id: string
): Promise<{ data: PlutoMedia }> {
  const driver = requireMediaDriver()
  await driver.authorize(event, 'media:manage')
  const body = (await readBody(event)) as {
    alt?: unknown
    name?: unknown
  } | null
  const patch: PlutoMediaPatch = {}
  if (typeof body?.alt === 'string') {
    patch.alt = body.alt.trim().slice(0, 500)
  }
  if (typeof body?.name === 'string' && body.name.trim()) {
    patch.name = body.name.trim().slice(0, 200)
  }
  if (patch.alt === undefined && patch.name === undefined) {
    throw createPlutoError({
      statusCode: 400,
      message: 'Send the alt text or the name.',
      key: 'pluto.media.errors.badPatch',
    })
  }
  return { data: await driver.update(event, id, patch) }
}

/** `PUT /api/_pluto/media/:id/preview`: multipart, with a `preview` part. Sets or replaces the preview image. */
export async function setMediaPreview(
  event: H3Event,
  id: string
): Promise<{ data: PlutoMedia }> {
  const driver = requireMediaDriver()
  await driver.authorize(event, 'media:manage')
  const parts = (await readMultipartFormData(event)) ?? []
  const preview = parts.find((part) => part.name === 'preview')
  if (!preview?.data.length) {
    throw createPlutoError({
      statusCode: 400,
      message: 'No preview sent.',
      key: 'pluto.media.errors.noFile',
    })
  }
  const [record] = await driver.get(event, [id])
  if (!record) {
    throw createPlutoError({
      statusCode: 404,
      message: 'The file does not exist.',
      key: 'pluto.media.errors.notFound',
    })
  }
  // The preview is named after the stored file: `mug-k3j9a.glb` gives `mug-k3j9a.preview.webp`.
  const stored = decodeURIComponent(
    new URL(record.url, 'http://x').pathname.split('/').pop() ?? record.id
  )
  return {
    data: await driver.setPreview(
      event,
      id,
      prepareMediaPreview(new Uint8Array(preview.data), stored)
    ),
  }
}

/** `DELETE /api/_pluto/media/:id`. */
export async function removeMedia(
  event: H3Event,
  id: string
): Promise<{ id: string }> {
  const driver = requireMediaDriver()
  await driver.authorize(event, 'media:delete')
  await driver.remove(event, id)
  return { id }
}

/**
 * `POST /api/_pluto/media/sizes`: fills in `width` and `height` of the images
 * that have none (files from before core media). It reads each image through
 * its URL. One call does at most `limit` images; call again while `remaining` > 0.
 */
export async function fillMediaSizes(
  event: H3Event,
  limit = 20
): Promise<{
  updated: number
  failed: number
  remaining: number
}> {
  const driver = requireMediaDriver()
  await driver.authorize(event, 'media:manage')
  const missing: PlutoMedia[] = []
  for (let offset = 0; ; offset += PLUTO_MEDIA_MAX_LIMIT) {
    const page = await driver.list(event, {
      limit: PLUTO_MEDIA_MAX_LIMIT,
      offset,
      type: 'image',
    })
    missing.push(...page.data.filter((item) => item.width === null))
    if (page.data.length < PLUTO_MEDIA_MAX_LIMIT) {
      break
    }
  }
  const origin = getRequestURL(event).origin
  let updated = 0
  let failed = 0
  for (const item of missing.slice(0, limit)) {
    try {
      const response = await fetch(new URL(item.url, origin))
      const size = response.ok
        ? readImageSize(new Uint8Array(await response.arrayBuffer()))
        : null
      if (!size) {
        failed++
        continue
      }
      await driver.update(event, item.id, size)
      updated++
    } catch {
      failed++
    }
  }
  return { updated, failed, remaining: Math.max(0, missing.length - limit) }
}

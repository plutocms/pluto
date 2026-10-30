import type { H3Event } from 'h3'
import type {
  PlutoMedia,
  PlutoMediaLimits,
  PlutoMediaQuery,
  PlutoMediaUpload,
} from '../../shared/types/media'
import { getQuery, getRequestURL, readBody, readMultipartFormData } from 'h3'
import {
  formatMediaSize,
  matchesMediaType,
  mediaFileName,
  PLUTO_MEDIA_MAX_LIMIT,
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
  if (file.data.length > limits.maxUploadBytes) {
    throw createPlutoError({
      statusCode: 413,
      message: 'The file is too large.',
      key: 'pluto.media.errors.tooLarge',
      params: { name, limit: formatMediaSize(limits.maxUploadBytes) },
    })
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
  const data = stripImageMetadata(file.data, mimeType)
  const size = mimeType.startsWith('image/') ? readImageSize(data) : null
  return {
    fileName: mediaFileName(name, mimeType, suffix),
    name,
    data,
    mimeType,
    size: data.length,
    width: size?.width ?? null,
    height: size?.height ?? null,
    alt: (file.alt ?? '').trim().slice(0, 500),
    createdAt: now.toISOString(),
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

/** `POST /api/_pluto/media`: multipart, with a `file` part and an optional `alt` part. */
export async function uploadMedia(
  event: H3Event
): Promise<{ data: PlutoMedia }> {
  const driver = requireMediaDriver()
  await driver.authorize(event, 'media:manage')
  const parts = (await readMultipartFormData(event)) ?? []
  const file = parts.find((part) => part.filename)
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
    },
    getMediaLimits()
  )
  return { data: await driver.upload(event, upload) }
}

/** `PATCH /api/_pluto/media/:id`: `{ alt }`. */
export async function updateMedia(
  event: H3Event,
  id: string
): Promise<{ data: PlutoMedia }> {
  const driver = requireMediaDriver()
  await driver.authorize(event, 'media:manage')
  const body = (await readBody(event)) as { alt?: unknown } | null
  if (typeof body?.alt !== 'string') {
    throw createPlutoError({
      statusCode: 400,
      message: 'Send the alt text.',
      key: 'pluto.media.errors.badPatch',
    })
  }
  return {
    data: await driver.update(event, id, {
      alt: body.alt.trim().slice(0, 500),
    }),
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

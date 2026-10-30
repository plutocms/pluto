import type { H3Event } from 'h3'

/**
 * One file of the media library. Core fills in every field at upload, from
 * the bytes on the server: a driver only stores the record. See the media
 * skill.
 */
export interface PlutoMedia {
  id: string
  /** The public URL. Absolute, or a path of the site (`/media/...`). */
  url: string
  /** The original file name, for people. The stored file has its own unique name. */
  name: string
  mimeType: string
  /** In bytes. */
  size: number
  /** In pixels. `null` for a file that is not an image. */
  width: number | null
  height: number | null
  /** The text alternative of an image. Empty when none is set. */
  alt: string
  /** ISO timestamp. */
  createdAt: string
}

/** A file as the public API gives it, in place of the id of a `media` field. */
export type PlutoPublicMedia = PlutoMedia

/** The query of `driver.list`. Core parses and limits it before the call. */
export interface PlutoMediaQuery {
  limit: number
  offset: number
  /** Matches the name and the alt text. */
  search?: string
  /** `image`, or a MIME type or prefix (`model/`, `application/pdf`). */
  type?: string
}

/** A complete new record, with the bytes. Core makes it; the driver stores it. */
export interface PlutoMediaUpload {
  /** The stored file name: a slug of the name, a random suffix, the extension. Unique. */
  fileName: string
  name: string
  data: Uint8Array
  mimeType: string
  size: number
  width: number | null
  height: number | null
  alt: string
  createdAt: string
}

export interface PlutoMediaPatch {
  alt?: string
  width?: number | null
  height?: number | null
}

export type PlutoMediaCapability = 'media:manage' | 'media:delete'

/**
 * The storage of one backend (GitHub, Supabase, ...). It stores the bytes and
 * the record together. Core owns the routes, the checks and the record. A
 * backend registers one driver on the server, with `registerMediaDriver`.
 */
export interface PlutoMediaDriver {
  name: string
  /** Throws 401 or 403. Core calls it before every admin read and every write. */
  authorize: (event: H3Event, capability: PlutoMediaCapability) => Promise<void>
  /** Newest first. */
  list: (
    event: H3Event,
    query: PlutoMediaQuery
  ) => Promise<{
    data: PlutoMedia[]
    total: number
  }>
  /** The records of these ids that exist, in any order. Public reads use it, with no caller. */
  get: (event: H3Event, ids: string[]) => Promise<PlutoMedia[]>
  upload: (event: H3Event, input: PlutoMediaUpload) => Promise<PlutoMedia>
  update: (
    event: H3Event,
    id: string,
    patch: PlutoMediaPatch
  ) => Promise<PlutoMedia>
  remove: (event: H3Event, id: string) => Promise<void>
}

/** The upload rules. `runtimeConfig.public.plutoMedia`. The server checks them on every upload. */
export interface PlutoMediaLimits {
  /** MIME types, or a family with `/*` (`image/*`). */
  allowedTypes: string[]
  maxUploadBytes: number
}

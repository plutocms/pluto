import type {
  PlutoMedia,
  PlutoMediaConfig,
  PlutoMediaSort,
} from '../../shared/types/media'
import type { PlutoMediaKind } from '../../shared/types/registry'
import { processMediaImage } from '../utils/pluto-media-image'

export interface PlutoMediaListQuery {
  limit?: number
  offset?: number
  search?: string
  /** `image`, or a MIME type or prefix. */
  type?: string
  sort?: PlutoMediaSort
}

/** A file that the browser refused before the upload. `key` is a `pluto.media.errors.*` text. */
export class PlutoMediaUploadProblem extends Error {
  constructor(
    readonly key: string,
    readonly params: Record<string, string | number>
  ) {
    super(key)
    this.name = 'PlutoMediaUploadProblem'
  }
}

/** A failed XHR request. `data` is the JSON answer, the shape that `usePlutoErrorText` reads. */
export class PlutoMediaRequestError extends Error {
  constructor(
    readonly statusCode: number,
    readonly data: unknown
  ) {
    super(`The media request failed (${statusCode}).`)
    this.name = 'PlutoMediaRequestError'
  }
}

/**
 * Sends a form with XHR, so the caller gets the upload progress (0 to 1).
 * `$fetch` has no upload progress. Same origin, so the cookies go with it.
 */
function sendForm<T>(
  method: 'POST' | 'PUT',
  url: string,
  body: FormData,
  onProgress?: (part: number) => void
): Promise<T> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest()
    request.open(method, url)
    request.responseType = 'json'
    request.setRequestHeader('Accept', 'application/json')
    request.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) {
        onProgress?.(event.loaded / event.total)
      }
    })
    request.addEventListener('load', () => {
      if (request.status >= 200 && request.status < 300) {
        resolve(request.response as T)
        return
      }
      reject(new PlutoMediaRequestError(request.status, request.response))
    })
    request.addEventListener('error', () =>
      reject(new PlutoMediaRequestError(0, null))
    )
    request.send(body)
  })
}

/**
 * The kinds of files of the app (`mediaKinds` of the extensions): images and
 * PDFs from core, and the kinds that layers add (3D models). `kindOf` gives
 * the first kind that takes a type.
 */
export function usePlutoMediaKinds() {
  const registry = usePlutoRegistry()
  const items = computed<PlutoMediaKind[]>(() => registry.mediaKinds.list.value)

  function kindOf(mimeType: string): PlutoMediaKind | undefined {
    return items.value.find((kind) => matchesMediaType(mimeType, kind.accept))
  }

  return { items, kindOf }
}

/**
 * The media library of the app, through the core routes
 * (`/api/_pluto/media`), for every backend. `enabled` is false while no
 * backend registers a media driver. See the media skill.
 */
export function usePlutoMedia() {
  const config = useRuntimeConfig().public.plutoMedia as
    PlutoMediaConfig | undefined
  const enabled = Boolean(config?.driver)
  const limits = resolveMediaLimits(config)
  const kinds = usePlutoMediaKinds()

  function list(query: PlutoMediaListQuery = {}) {
    return $fetch<{ data: PlutoMedia[]; total: number }>('/api/_pluto/media', {
      query,
    })
  }

  async function get(ids: string[]): Promise<PlutoMedia[]> {
    if (ids.length === 0) {
      return []
    }
    const result = await $fetch<{ data: PlutoMedia[] }>('/api/_pluto/media', {
      query: { ids: ids.join(',') },
    })
    return result.data
  }

  /** The type of a file as the browser sees it, or from its name. */
  function typeOf(file: File): string {
    return (
      file.type || mediaTypeFromName(file.name) || 'application/octet-stream'
    )
  }

  /**
   * The browser check of a file (the server checks again), before any upload.
   * `accept` narrows the allowed types, as a `media` field does.
   */
  function check(file: File, accept?: string[]): void {
    const type = typeOf(file)
    const allowed =
      matchesMediaType(type, limits.allowedTypes) &&
      matchesMediaType(type, accept)
    // An image the browser makes WebP can be over the limit before it, so the
    // size check waits for the processed file.
    if (
      !allowed &&
      !(type.startsWith('image/') && matchesMediaType('image/webp', accept))
    ) {
      throw new PlutoMediaUploadProblem('pluto.media.errors.typeNotAllowed', {
        name: file.name,
      })
    }
  }

  /** A preview image of a file, made by its kind. `null` when the kind makes none, or fails. */
  async function makePreview(file: Blob, mimeType: string) {
    const create = kinds.kindOf(mimeType)?.createPreview
    if (!create) {
      return null
    }
    try {
      return await create(file)
    } catch {
      return null
    }
  }

  /** The warning of the kind of a file (`kind.inspect`), or `null`. */
  async function inspect(file: Blob, mimeType: string) {
    try {
      return (await kinds.kindOf(mimeType)?.inspect?.(file)) ?? null
    } catch {
      return null
    }
  }

  /**
   * Processes an image in the browser (see `processMediaImage`), makes the
   * preview of a file that has a kind with `createPreview`, then uploads.
   * `onProgress` gets the upload progress, 0 to 1.
   */
  async function upload(
    file: File,
    options: {
      alt?: string
      accept?: string[]
      onProgress?: (part: number) => void
      /** A warning of the kind of the file (`kind.inspect`). The upload goes on. */
      onWarning?: (warning: string) => void
    } = {}
  ): Promise<PlutoMedia> {
    check(file, options.accept)
    const ready = await processMediaImage(file)
    const type = typeOf(ready)
    const limit = mediaMaxBytes(limits, type)
    if (ready.size > limit) {
      throw new PlutoMediaUploadProblem('pluto.media.errors.tooLarge', {
        name: file.name,
        limit: formatMediaSize(limit),
      })
    }
    const body = new FormData()
    // The original name, for people. The server names the stored file from the real type.
    body.append('file', ready, file.name)
    if (options.alt) {
      body.append('alt', options.alt)
    }
    const warning = await inspect(ready, type)
    if (warning) {
      options.onWarning?.(warning)
    }
    const preview = await makePreview(ready, type)
    if (preview) {
      body.append('preview', preview, 'preview')
    }
    const result = await sendForm<{ data: PlutoMedia }>(
      'POST',
      '/api/_pluto/media',
      body,
      options.onProgress
    )
    return result.data
  }

  async function update(
    id: string,
    patch: { alt?: string; name?: string }
  ): Promise<PlutoMedia> {
    const result = await $fetch<{ data: PlutoMedia }>(
      `/api/_pluto/media/${encodeURIComponent(id)}`,
      { method: 'PATCH', body: patch }
    )
    return result.data
  }

  /** Makes the preview of a stored file (its kind renders the file from its URL) and saves it. */
  async function createPreview(media: PlutoMedia): Promise<PlutoMedia | null> {
    const response = await fetch(media.url)
    if (!response.ok) {
      return null
    }
    const preview = await makePreview(await response.blob(), media.mimeType)
    if (!preview) {
      return null
    }
    const body = new FormData()
    body.append('preview', preview, 'preview')
    const result = await sendForm<{ data: PlutoMedia }>(
      'PUT',
      `/api/_pluto/media/${encodeURIComponent(media.id)}/preview`,
      body
    )
    return result.data
  }

  async function remove(id: string): Promise<void> {
    await $fetch(`/api/_pluto/media/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    })
  }

  function fillSizes() {
    return $fetch<{ updated: number; failed: number; remaining: number }>(
      '/api/_pluto/media/sizes',
      { method: 'POST' }
    )
  }

  return {
    enabled,
    limits,
    kinds,
    list,
    get,
    upload,
    update,
    createPreview,
    remove,
    fillSizes,
  }
}

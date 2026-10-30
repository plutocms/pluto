import type { PlutoMedia, PlutoMediaLimits } from '../../shared/types/media'
import { processMediaImage } from '../utils/pluto-media-image'

export interface PlutoMediaListQuery {
  limit?: number
  offset?: number
  search?: string
  /** `image`, or a MIME type or prefix. */
  type?: string
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

/**
 * The media library of the app, through the core routes
 * (`/api/_pluto/media`), for every backend. `enabled` is false while no
 * backend registers a media driver. See the media skill.
 */
export function usePlutoMedia() {
  const config = useRuntimeConfig().public.plutoMedia as
    (Partial<PlutoMediaLimits> & { driver?: string }) | undefined
  const enabled = Boolean(config?.driver)
  const limits = resolveMediaLimits(config)

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

  /**
   * The browser check of a file (the server checks again), before any upload.
   * `accept` narrows the allowed types, as a `media` field does.
   */
  function check(file: File, accept?: string[]): void {
    const type = file.type || mediaTypeFromName(file.name) || 'application/octet-stream'
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

  /** Processes an image in the browser (see `processMediaImage`), then uploads the file. */
  async function upload(
    file: File,
    options: {
      alt?: string
      accept?: string[]
    } = {}
  ): Promise<PlutoMedia> {
    check(file, options.accept)
    const ready = await processMediaImage(file)
    if (ready.size > limits.maxUploadBytes) {
      throw new PlutoMediaUploadProblem('pluto.media.errors.tooLarge', {
        name: file.name,
        limit: formatMediaSize(limits.maxUploadBytes),
      })
    }
    const body = new FormData()
    // The original name, for people. The server names the stored file from the real type.
    body.append('file', ready, file.name)
    if (options.alt) {
      body.append('alt', options.alt)
    }
    const result = await $fetch<{ data: PlutoMedia }>('/api/_pluto/media', {
      method: 'POST',
      body,
    })
    return result.data
  }

  async function update(
    id: string,
    patch: { alt: string }
  ): Promise<PlutoMedia> {
    const result = await $fetch<{ data: PlutoMedia }>(
      `/api/_pluto/media/${encodeURIComponent(id)}`,
      { method: 'PATCH', body: patch }
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

  return { enabled, limits, list, get, upload, update, remove, fillSizes }
}

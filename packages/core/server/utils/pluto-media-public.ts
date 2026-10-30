import type { H3Event } from 'h3'
import type {
  PlutoContentItem,
  PlutoContentType,
} from '../../shared/types/content'
import type { PlutoMedia } from '../../shared/types/media'
import { mediaFieldIds } from '../../shared/utils/media'
import { getMediaDriver } from './pluto-media-driver'

const publicMediaCache = new WeakMap<
  PlutoContentItem[],
  Promise<Map<string, PlutoMedia>>
>()

/** The records of every `media` field of the items of one answer, with one `driver.get`. */
function loadPublicMedia(
  event: H3Event,
  type: PlutoContentType,
  batch: PlutoContentItem[]
): Promise<Map<string, PlutoMedia>> {
  const cached = publicMediaCache.get(batch)
  if (cached) {
    return cached
  }
  const ids = new Set<string>()
  for (const field of type.fields) {
    if (field.type === 'media') {
      for (const item of batch) {
        for (const id of mediaFieldIds(item[field.name])) {
          ids.add(id)
        }
      }
    }
  }
  const driver = getMediaDriver()
  const pending = (async () => {
    if (!driver || ids.size === 0) {
      return new Map<string, PlutoMedia>()
    }
    const records = await driver.get(event, [...ids])
    return new Map(records.map((record) => [record.id, record]))
  })()
  publicMediaCache.set(batch, pending)
  return pending
}

/**
 * Puts the records in place of the ids of the public `media` fields of `data`:
 * one record (or `null`), or a list for a `multiple` field. An id with no
 * record (a deleted file) is dropped.
 */
export async function expandPublicMedia(
  event: H3Event,
  type: PlutoContentType,
  data: Record<string, unknown>,
  batch: PlutoContentItem[]
): Promise<Record<string, unknown>> {
  const fields = type.fields.filter(
    (field) => field.type === 'media' && Object.hasOwn(data, field.name)
  )
  if (fields.length === 0) {
    return data
  }
  const records = await loadPublicMedia(event, type, batch)
  const result = { ...data }
  for (const field of fields) {
    const list = mediaFieldIds(data[field.name])
      .map((id) => records.get(id))
      .filter((record): record is PlutoMedia => Boolean(record))
    result[field.name] =
      field.type === 'media' && field.multiple ? list : (list[0] ?? null)
  }
  return result
}

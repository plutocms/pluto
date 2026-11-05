import type { PlutoContentType, PlutoPreviewItem } from '../types/content'
import type { PlutoMedia } from '../types/media'
import type { PlutoPublicReference } from '../types/public-api'
import { isTargetReference, referenceFieldIds } from './content-reference'
import { mediaFieldIds } from './media'

/** The keys of a form item that can hold a date, by the public key. The first one set wins. */
function dateKeys(
  type: PlutoContentType | undefined,
  key: 'created' | 'updated' | 'published'
): string[] {
  const snake = {
    created: 'created_at',
    updated: 'updated_at',
    published: 'published_at',
  }[key]
  const configured =
    key === 'published'
      ? type?.status
        ? type.status.publishedAtColumn
        : undefined
      : type?.timestamps
        ? type.timestamps[key]
        : undefined
  return [
    ...(typeof configured === 'string' ? [configured] : []),
    `${key}At`,
    snake,
  ]
}

function firstText(
  item: Record<string, unknown>,
  keys: string[]
): string | undefined {
  for (const key of keys) {
    const value = item[key]
    if (typeof value === 'string' && value) {
      return value
    }
  }
  return undefined
}

/**
 * A form item in the shape of the public API (`usePlutoPublicItem`), for a preview: the field
 * values, `html`, and the dates as `createdAt`, `updatedAt` and `publishedAt`, whatever the
 * columns of the backend are. A media field gets its record (an array for `multiple`, else one
 * record or `null`) from `media`: the records of its ids. A `reference` field with a `target` gets
 * `{ id, label, slug? }` from `references` (target type name, then id), like the public API: a list
 * for `multiple`, else one reference or `null`; an id with no entry is dropped. A preview component
 * can then render the same object as the public page. Pure.
 */
export function toPreviewItem(
  type: PlutoContentType | undefined,
  item: Record<string, unknown>,
  html: string,
  media: ReadonlyMap<string, PlutoMedia> = new Map(),
  references: ReadonlyMap<
    string,
    ReadonlyMap<string, PlutoPublicReference>
  > = new Map()
): PlutoPreviewItem {
  const result: Record<string, unknown> = { ...item }
  for (const field of type?.fields ?? []) {
    if (isTargetReference(field)) {
      const known = references.get(field.target)
      const list = referenceFieldIds(item[field.name])
        .map((id) => known?.get(id))
        .filter((entry): entry is PlutoPublicReference => Boolean(entry))
      result[field.name] = field.multiple ? list : (list[0] ?? null)
      continue
    }
    if (field.type !== 'media') {
      continue
    }
    const records = mediaFieldIds(item[field.name])
      .map((id) => media.get(id))
      .filter((record): record is PlutoMedia => Boolean(record))
    result[field.name] = field.multiple ? records : (records[0] ?? null)
  }
  for (const key of ['created', 'updated', 'published'] as const) {
    const value = firstText(item, dateKeys(type, key))
    if (value) {
      result[`${key}At`] = value
    } else {
      delete result[`${key}At`]
    }
  }
  return { ...result, html } as PlutoPreviewItem
}

/** The media ids of every media field of a form item. */
export function previewMediaIds(
  type: PlutoContentType | undefined,
  item: Record<string, unknown>
): string[] {
  return [
    ...new Set(
      (type?.fields ?? [])
        .filter((field) => field.type === 'media')
        .flatMap((field) => mediaFieldIds(item[field.name]))
    ),
  ]
}

/** The names of the content types that the target references of a type point to. */
export function previewReferenceTargets(
  type: PlutoContentType | undefined
): string[] {
  return [
    ...new Set(
      (type?.fields ?? [])
        .filter(isTargetReference)
        .map((field) => field.target)
    ),
  ]
}

/** The ids that the reference fields of a form item hold for the content type `target`. */
export function previewReferenceIds(
  type: PlutoContentType | undefined,
  item: Record<string, unknown>,
  target: string
): string[] {
  return [
    ...new Set(
      (type?.fields ?? [])
        .filter((field) => isTargetReference(field) && field.target === target)
        .flatMap((field) => referenceFieldIds(item[field.name]))
    ),
  ]
}

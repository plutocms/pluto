import type {
  PlutoContentType,
  PlutoPreviewItem,
  PlutoReferenceField,
} from '../types/content'
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
 * A referenced item for the preview: the public reference, and the raw values of the target
 * fields that a `publicFields` list asks for (a media field holds its ids here).
 */
export type PlutoPreviewReference = PlutoPublicReference &
  Record<string, unknown>

/** The keys of a reference. A `publicFields` entry with one of these names is skipped. */
const REFERENCE_KEYS = new Set(['id', 'label', 'slug'])

/** The `publicFields` names of a reference field, without the reference keys. */
function extraNames(field: PlutoReferenceField): string[] {
  return (field.publicFields ?? []).filter((name) => !REFERENCE_KEYS.has(name))
}

/** The `publicFields` that the reference fields of `type` ask from the content type `target`. */
export function previewPublicFields(
  type: PlutoContentType | undefined,
  target: string
): string[] {
  const names = new Set<string>()
  for (const field of type?.fields ?? []) {
    if (isTargetReference(field) && field.target === target) {
      for (const name of extraNames(field)) {
        names.add(name)
      }
    }
  }
  return [...names]
}

/** The value of a target field for the preview: a media field gets its record or records. */
function previewExtraValue(
  targetType: PlutoContentType | undefined,
  name: string,
  value: unknown,
  media: ReadonlyMap<string, PlutoMedia>
): unknown {
  const field = targetType?.fields.find((entry) => entry.name === name)
  if (field?.type !== 'media') {
    return value ?? null
  }
  const records = mediaFieldIds(value)
    .map((id) => media.get(id))
    .filter((record): record is PlutoMedia => Boolean(record))
  return field.multiple ? records : (records[0] ?? null)
}

/**
 * A form item in the shape of the public API (`usePlutoPublicItem`), for a preview: the field
 * values, `html`, and the dates as `createdAt`, `updatedAt` and `publishedAt`, whatever the
 * columns of the backend are. A media field gets its record (an array for `multiple`, else one
 * record or `null`) from `media`: the records of its ids. A `reference` field with a `target` gets
 * `{ id, label, slug? }` from `references` (target type name, then id), like the public API: a list
 * for `multiple`, else one reference or `null`; an id with no entry is dropped. A field with
 * `publicFields` adds those values of the entry, with the media records from `media` (`typeOf`
 * gives the target type). A preview component can then render the same object as the public
 * page. Pure.
 */
export function toPreviewItem(
  type: PlutoContentType | undefined,
  item: Record<string, unknown>,
  html: string,
  media: ReadonlyMap<string, PlutoMedia> = new Map(),
  references: ReadonlyMap<
    string,
    ReadonlyMap<string, PlutoPreviewReference>
  > = new Map(),
  typeOf: (name: string) => PlutoContentType | undefined = () => undefined
): PlutoPreviewItem {
  const result: Record<string, unknown> = { ...item }
  for (const field of type?.fields ?? []) {
    if (isTargetReference(field)) {
      const known = references.get(field.target)
      const names = extraNames(field)
      const targetType = names.length > 0 ? typeOf(field.target) : undefined
      const list = referenceFieldIds(item[field.name])
        .map((id) => known?.get(id))
        .filter((entry): entry is PlutoPreviewReference => Boolean(entry))
        .map((entry): PlutoPublicReference => {
          const reference: Record<string, unknown> = {
            id: entry.id,
            label: entry.label,
            ...(entry.slug !== undefined && { slug: entry.slug }),
          }
          for (const name of names) {
            reference[name] = previewExtraValue(
              targetType,
              name,
              entry[name],
              media
            )
          }
          return reference as unknown as PlutoPublicReference
        })
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

/**
 * The media ids of the `publicFields` of the items that the reference fields of a form item point
 * to (an author avatar), for the media load of the preview.
 */
export function previewReferenceMediaIds(
  type: PlutoContentType | undefined,
  item: Record<string, unknown>,
  references: ReadonlyMap<string, ReadonlyMap<string, PlutoPreviewReference>>,
  typeOf: (name: string) => PlutoContentType | undefined
): string[] {
  const ids = new Set<string>()
  for (const field of type?.fields ?? []) {
    if (!isTargetReference(field)) {
      continue
    }
    const media = (typeOf(field.target)?.fields ?? [])
      .filter((entry) => entry.type === 'media')
      .map((entry) => entry.name)
      .filter((name) => extraNames(field).includes(name))
    if (media.length === 0) {
      continue
    }
    const known = references.get(field.target)
    for (const id of referenceFieldIds(item[field.name])) {
      const entry = known?.get(id)
      for (const name of media) {
        for (const mediaId of mediaFieldIds(entry?.[name])) {
          ids.add(mediaId)
        }
      }
    }
  }
  return [...ids]
}

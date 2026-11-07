import type { H3Event } from 'h3'
import type {
  PlutoContentItem,
  PlutoContentType,
  PlutoField,
} from '../../shared/types/content'
import type { PlutoPublicReference } from '../../shared/types/public-api'
import {
  isTargetReference,
  referenceFieldIds,
} from '../../shared/utils/content-reference'
import { getContentType } from './pluto-content'
import { requireContentAdapter } from './pluto-content-handlers'
import { expandPublicMedia } from './pluto-media-public'

/** One published item of a target: its reference, and the values of the `publicFields` asked for. */
interface LoadedReference {
  reference: PlutoPublicReference
  extra: Record<string, unknown>
}

/** The loaded references of one target type, by id (as text). */
type ReferenceMap = Map<string, LoadedReference>

/** The keys of a reference. A `publicFields` entry with one of these names is skipped. */
const REFERENCE_KEYS = new Set(['id', 'label', 'slug'])

const publicReferenceCache = new WeakMap<
  PlutoContentItem[],
  Map<string, Promise<ReferenceMap>>
>()

function isPublicType(type: PlutoContentType | undefined): boolean {
  return type?.api?.public === true
}

function isPublished(type: PlutoContentType, item: PlutoContentItem): boolean {
  return (
    !type.status || item.status === (type.status.publishedValue ?? 'published')
  )
}

/** True when the public answer has the field: it is stored and the `api.fields` list keeps it. */
function isPublicField(type: PlutoContentType, name: string): boolean {
  const field = type.fields.find((entry) => entry.name === name)
  return (
    Boolean(field) &&
    !field?.virtual &&
    (!type.api?.fields || type.api.fields.includes(name))
  )
}

/** The public `reference` fields of the type that point to the content type `target`. */
function fieldsTo(type: PlutoContentType, target: string) {
  return type.fields.filter(
    (field) =>
      isTargetReference(field) &&
      field.target === target &&
      isPublicField(type, field.name)
  )
}

/** The `publicFields` of a field that the target can give: its public fields, not a reference key. */
function extraFieldsOf(field: PlutoField, target: PlutoContentType): string[] {
  if (field.type !== 'reference') {
    return []
  }
  return (field.publicFields ?? []).filter(
    (name) => !REFERENCE_KEYS.has(name) && isPublicField(target, name)
  )
}

/**
 * The references of the published items of `target` that the items of one answer use, with one
 * `list`. Each one keeps the `publicFields` that the fields of `type` ask for, with the media
 * records in place of the media ids (one media read for the answer).
 */
function loadReferences(
  event: H3Event,
  type: PlutoContentType,
  target: PlutoContentType,
  batch: PlutoContentItem[]
): Promise<ReferenceMap> {
  let byTarget = publicReferenceCache.get(batch)
  if (!byTarget) {
    byTarget = new Map()
    publicReferenceCache.set(batch, byTarget)
  }
  const cached = byTarget.get(target.name)
  if (cached) {
    return cached
  }
  const ids = new Set<string>()
  const extraNames = new Set<string>()
  for (const field of fieldsTo(type, target.name)) {
    for (const name of extraFieldsOf(field, target)) {
      extraNames.add(name)
    }
    for (const item of batch) {
      for (const id of referenceFieldIds(item[field.name])) {
        ids.add(id)
      }
    }
  }
  const pending = (async () => {
    const map: ReferenceMap = new Map()
    if (ids.size === 0) {
      return map
    }
    const result = await requireContentAdapter().list(
      { event, type: target },
      { ids: [...ids], limit: ids.size, includeUnpublished: false }
    )
    const slugField = target.slug ? target.slug.field : undefined
    // An adapter may ignore `ids`: core matches them again.
    const items = result.data.filter(
      (item) => ids.has(String(item.id)) && isPublished(target, item)
    )
    for (const item of items) {
      const slug = slugField ? item[slugField] : undefined
      let extra: Record<string, unknown> = {}
      for (const name of extraNames) {
        extra[name] = item[name] ?? null
      }
      if (extraNames.size > 0) {
        // `items` is the batch of the media read: one read for every target item.
        extra = await expandPublicMedia(event, target, extra, items)
      }
      map.set(String(item.id), {
        reference: {
          id: item.id,
          label: String(item[target.titleField] ?? ''),
          ...(typeof slug === 'string' && slug !== '' && { slug }),
        },
        extra,
      })
    }
    return map
  })()
  byTarget.set(target.name, pending)
  return pending
}

/**
 * Puts `{ id, label, slug? }` in place of the ids of the public `reference` fields of `data` that
 * have a public `target` type: a list for a `multiple` field, else one reference or `null`. A
 * field with `publicFields` adds those fields of the target to each reference. An id with no
 * published item is dropped. A field with no value gives `[]` or `null`. A reference to a private
 * type keeps its ids. It reads each target type once for the items of one answer.
 */
export async function expandPublicReferences(
  event: H3Event,
  type: PlutoContentType,
  data: Record<string, unknown>,
  batch: PlutoContentItem[]
): Promise<Record<string, unknown>> {
  const fields = type.fields.filter(
    (field) => isTargetReference(field) && isPublicField(type, field.name)
  )
  if (fields.length === 0) {
    return data
  }
  const result = { ...data }
  for (const field of fields) {
    if (!isTargetReference(field)) {
      continue
    }
    const target = getContentType(field.target)
    if (!target || !isPublicType(target)) {
      continue
    }
    const references = await loadReferences(event, type, target, batch)
    const names = extraFieldsOf(field, target)
    const list = referenceFieldIds(data[field.name])
      .map((id) => references.get(id))
      .filter((entry): entry is LoadedReference => Boolean(entry))
      .map(({ reference, extra }) => {
        if (names.length === 0) {
          return reference
        }
        const added: Record<string, unknown> = {}
        for (const name of names) {
          added[name] = extra[name] ?? null
        }
        return { ...reference, ...added }
      })
    result[field.name] = field.multiple ? list : (list[0] ?? null)
  }
  return result
}

/**
 * Turns the value of each filter on a `target` reference into the id of the item: the value is an
 * id or a slug (one `get` on the target type). `empty` is true when a value names no published
 * item, so the filter matches nothing. Other filters stay as they are.
 */
export async function resolveReferenceFilters(
  event: H3Event,
  type: PlutoContentType,
  filters: Record<string, string> | undefined
): Promise<{
  filters: Record<string, string> | undefined
  empty: boolean
}> {
  if (!filters) {
    return { filters, empty: false }
  }
  const resolved = { ...filters }
  for (const [name, value] of Object.entries(filters)) {
    const field = type.fields.find((entry) => entry.name === name)
    if (!field || !isTargetReference(field)) {
      continue
    }
    const target = getContentType(field.target)
    if (!target) {
      continue
    }
    const item = await requireContentAdapter().get(
      { event, type: target },
      value
    )
    if (!item || !isPublished(target, item)) {
      return { filters: resolved, empty: true }
    }
    resolved[name] = String(item.id)
  }
  return { filters: resolved, empty: false }
}

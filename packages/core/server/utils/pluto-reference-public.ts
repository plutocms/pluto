import type { H3Event } from 'h3'
import type {
  PlutoContentItem,
  PlutoContentType,
} from '../../shared/types/content'
import type { PlutoPublicReference } from '../../shared/types/public-api'
import {
  isTargetReference,
  referenceFieldIds,
} from '../../shared/utils/content-reference'
import { getContentType } from './pluto-content'
import { requireContentAdapter } from './pluto-content-handlers'

/** The target type name, then the references of its published items by id (as text). */
type ReferenceMap = Map<string, PlutoPublicReference>

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

/** The references of the published items of `target` that the items of one answer use, with one `list`. */
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
  for (const field of fieldsTo(type, target.name)) {
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
    for (const item of result.data) {
      // An adapter may ignore `ids`: core matches them again.
      const id = String(item.id)
      if (!ids.has(id) || !isPublished(target, item)) {
        continue
      }
      const slug = slugField ? item[slugField] : undefined
      map.set(id, {
        id: item.id,
        label: String(item[target.titleField] ?? ''),
        ...(typeof slug === 'string' && slug !== '' && { slug }),
      })
    }
    return map
  })()
  byTarget.set(target.name, pending)
  return pending
}

/**
 * Puts `{ id, label, slug? }` in place of the ids of the public `reference` fields of `data` that
 * have a public `target` type: a list for a `multiple` field, else one reference or `null`. An id
 * with no published item is dropped. A field with no value gives `[]` or `null`. A reference to
 * a private type keeps its ids. It reads each target type once for the items of one answer.
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
    const list = referenceFieldIds(data[field.name])
      .map((id) => references.get(id))
      .filter((entry): entry is PlutoPublicReference => Boolean(entry))
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

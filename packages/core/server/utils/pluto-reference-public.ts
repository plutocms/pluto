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
import { isLiveItem } from '../../shared/utils/content-status'
import { getContentType } from './pluto-content'
import { requireContentAdapter } from './pluto-content-handlers'
import { expandPublicMedia } from './pluto-media-public'

interface LoadedReference {
  reference: PlutoPublicReference
  extra: Record<string, unknown>
}

type ReferenceMap = Map<string, LoadedReference>

const REFERENCE_KEYS = new Set(['id', 'label', 'slug'])

const publicReferenceCache = new WeakMap<
  PlutoContentItem[],
  Map<string, Promise<ReferenceMap>>
>()

function isPublicType(type: PlutoContentType | undefined): boolean {
  return type?.api?.public === true
}

function isPublished(type: PlutoContentType, item: PlutoContentItem): boolean {
  return isLiveItem(type, item)
}

function isPublicField(type: PlutoContentType, name: string): boolean {
  const field = type.fields.find((entry) => entry.name === name)
  return (
    Boolean(field) &&
    !field?.virtual &&
    (!type.api?.fields || type.api.fields.includes(name))
  )
}

function fieldsTo(type: PlutoContentType, target: string) {
  return type.fields.filter(
    (field) =>
      isTargetReference(field) &&
      field.target === target &&
      isPublicField(type, field.name)
  )
}

function extraFieldsOf(field: PlutoField, target: PlutoContentType): string[] {
  if (field.type !== 'reference') {
    return []
  }
  return (field.publicFields ?? []).filter(
    (name) => !REFERENCE_KEYS.has(name) && isPublicField(target, name)
  )
}

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

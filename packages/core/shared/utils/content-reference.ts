import type { PlutoContentType, PlutoReferenceField } from '../types/content'

/**
 * The ids that a `reference` field value holds: one id, a list, or nothing. A number stays a
 * number. An empty text and a value of another kind are dropped.
 */
export function referenceValue(value: unknown): Array<string | number> {
  const list = Array.isArray(value) ? value : [value]
  return list.filter(
    (entry): entry is string | number =>
      (typeof entry === 'string' && entry !== '') ||
      (typeof entry === 'number' && Number.isFinite(entry))
  )
}

/** The ids of a `reference` field value, as text. */
export function referenceFieldIds(value: unknown): string[] {
  return referenceValue(value).map(String)
}

/** True for a `reference` field that names a content type (`target`). */
export function isTargetReference(
  field: PlutoContentType['fields'][number]
): field is PlutoReferenceField & { target: string } {
  return field.type === 'reference' && Boolean(field.target)
}

/** The `reference` fields of the type that name the content type `target`. */
export function referenceFieldsTo(
  type: PlutoContentType,
  target: string
): Array<PlutoReferenceField & { target: string }> {
  return type.fields.filter(
    (field): field is PlutoReferenceField & { target: string } =>
      isTargetReference(field) && field.target === target
  )
}

import type { PlutoContentType, PlutoReferenceField } from '../types/content'

export function referenceValue(value: unknown): Array<string | number> {
  const list = Array.isArray(value) ? value : [value]
  return list.filter(
    (entry): entry is string | number =>
      (typeof entry === 'string' && entry !== '') ||
      (typeof entry === 'number' && Number.isFinite(entry))
  )
}

export function referenceFieldIds(value: unknown): string[] {
  return referenceValue(value).map(String)
}

export function isTargetReference(
  field: PlutoContentType['fields'][number]
): field is PlutoReferenceField & { target: string } {
  return field.type === 'reference' && Boolean(field.target)
}

export function referenceFieldsTo(
  type: PlutoContentType,
  target: string
): Array<PlutoReferenceField & { target: string }> {
  return type.fields.filter(
    (field): field is PlutoReferenceField & { target: string } =>
      isTargetReference(field) && field.target === target
  )
}

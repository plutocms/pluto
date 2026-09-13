import type { PlutoContentItem, PlutoContentType, PlutoField } from '../types/content'

/** Resolves the storage column for a field. Falls back to `field.name` when `field.column` is unset. */
export function fieldColumn(field: PlutoField): string {
  return field.column ?? field.name
}

/**
 * Converts a field-keyed payload into a column-keyed one, for every field
 * in `type.fields` present in `payload`. A field absent from `payload` is
 * left out of the result, so a partial update payload stays partial after
 * mapping. An adapter (a later wave) sends the result straight to its
 * storage layer.
 *
 * A field with `virtual: true` never appears in the result, even when
 * `payload` has a value for it — it has no storage column by design.
 */
export function mapFieldsToColumns(
  type: PlutoContentType,
  payload: Record<string, unknown>
): Record<string, unknown> {
  const columns: Record<string, unknown> = {}

  for (const field of type.fields) {
    if (field.virtual) {
      continue
    }
    if (Object.hasOwn(payload, field.name)) {
      columns[fieldColumn(field)] = payload[field.name]
    }
  }

  return columns
}

/**
 * Converts a column-keyed row into a field-keyed `PlutoContentItem`, for
 * every field in `type.fields`, plus the primary key column (`type.primaryKey`,
 * default `'id'`) mapped to `item.id`. A column absent from `row` is left
 * out of the result field.
 *
 * A field with `virtual: true` is skipped, for symmetry with
 * `mapFieldsToColumns` — it has no column to read back from `row` in the
 * first place, so this only guards against a stray column that happens to
 * share the field's name.
 */
export function mapColumnsToFields(
  type: PlutoContentType,
  row: Record<string, unknown>
): PlutoContentItem {
  const primaryKey = type.primaryKey ?? 'id'
  const item: Record<string, unknown> = { id: row[primaryKey] }

  for (const field of type.fields) {
    if (field.virtual) {
      continue
    }
    const column = fieldColumn(field)
    if (Object.hasOwn(row, column)) {
      item[field.name] = row[column]
    }
  }

  return item as PlutoContentItem
}

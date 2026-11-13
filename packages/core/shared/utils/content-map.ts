import type {
  PlutoContentItem,
  PlutoContentType,
  PlutoField,
} from '../types/content'

/** The storage column of a field: `field.column`, else `field.name`. */
export function fieldColumn(field: PlutoField): string {
  return field.column ?? field.name
}

/**
 * Converts a field-keyed payload into a column-keyed one. A field that is not in `payload` stays
 * out of the result, so a partial update stays partial. A `virtual` field never appears in the
 * result.
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
 * Converts a column-keyed row into a field-keyed `PlutoContentItem`. The primary key column
 * (`type.primaryKey`, default `'id'`) becomes `item.id`. A `virtual` field is skipped. When
 * `type.status` is set, the status column becomes `item.status`, unless a declared field already
 * set it.
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

  if (type.status) {
    const statusColumn = type.status.column ?? 'status'
    if (!Object.hasOwn(item, 'status') && Object.hasOwn(row, statusColumn)) {
      item.status = row[statusColumn]
    }
  }

  return item as PlutoContentItem
}

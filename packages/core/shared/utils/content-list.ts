import type {
  PlutoContentItem,
  PlutoContentQuery,
  PlutoContentType,
  PlutoField,
} from '../types/content'
import { isTargetReference } from './content-reference'
import { contentStatusValues } from './content-status'

export function formatListValue(
  field: PlutoField,
  item: PlutoContentItem
): string {
  const value = item[field.name]

  if (field.listFormat) {
    try {
      return String(field.listFormat(value, item) ?? '')
    } catch {
      return rawListValue(value)
    }
  }

  return rawListValue(value)
}

function rawListValue(value: unknown): string {
  if (value === null || value === undefined) {
    return ''
  }
  if (typeof value === 'object') {
    return JSON.stringify(value)
  }
  return String(value)
}

export const ADMIN_LIST_SEARCH_MAX = 200

const FILTER_VALUE_MAX = 200

const SORTABLE_TYPES = new Set<PlutoField['type']>([
  'text',
  'textarea',
  'slug',
  'number',
  'select',
  'boolean',
  'date',
])

function isListFilterField(field: PlutoField): boolean {
  if (field.filter === false || field.virtual) {
    return false
  }
  if (isTargetReference(field)) {
    return true
  }
  return (
    (field.type === 'select' || field.type === 'boolean') &&
    (field.filter === true || field.inList === true)
  )
}

export function isListSortField(field: PlutoField): boolean {
  return (
    field.inList === true &&
    field.sortable !== false &&
    !field.virtual &&
    SORTABLE_TYPES.has(field.type)
  )
}

export function listFilterFields(type: PlutoContentType): PlutoField[] {
  return type.fields
    .filter(isListFilterField)
    .sort((a, b) => (a.order ?? 100) - (b.order ?? 100))
}

/** The search, the filters and the sort of an admin list. Each part is optional. */
export interface PlutoAdminListQuery {
  search?: string
  /** A value of the publish workflow of the type. */
  status?: string
  /** Equality filters, by field name. */
  filters?: Record<string, string>
  sort?: NonNullable<PlutoContentQuery['sort']>
}

function singleText(value: unknown): string | undefined {
  const text = Array.isArray(value) ? value[0] : value
  return typeof text === 'string' ? text : undefined
}

function isFilterValue(field: PlutoField, value: string): boolean {
  if (value === '' || value.length > FILTER_VALUE_MAX) {
    return false
  }
  if (field.type === 'boolean') {
    return value === 'true' || value === 'false'
  }
  if (field.type === 'select') {
    return field.options.some((option) => String(option.value) === value)
  }
  return true
}

/**
 * Reads the search, the filters and the sort from a query: the query of the admin list route, or
 * the route query of the list page. The keys are `search`, `status`, `filter[<field>]` and `sort`
 * (`field` or `-field` for descending). `invalid` lists each key with a value that the type does
 * not allow. The route answers 400 for them, and the page drops them.
 */
export function parseAdminListQuery(
  type: PlutoContentType,
  raw: Record<string, unknown>
): { query: PlutoAdminListQuery; invalid: string[] } {
  const query: PlutoAdminListQuery = {}
  const invalid: string[] = []

  const search = singleText(raw.search)?.trim()
  if (search) {
    query.search = search.slice(0, ADMIN_LIST_SEARCH_MAX)
  }

  const status = singleText(raw.status)
  if (status !== undefined && status !== '') {
    if (contentStatusValues(type).some((entry) => entry.value === status)) {
      query.status = status
    } else {
      invalid.push('status')
    }
  }

  const sort = singleText(raw.sort)?.trim()
  if (sort) {
    const direction = sort.startsWith('-') ? 'desc' : 'asc'
    const name = sort.replace(/^-/, '')
    const field = type.fields.find((candidate) => candidate.name === name)
    if (field && isListSortField(field)) {
      query.sort = { field: name, direction }
    } else {
      invalid.push('sort')
    }
  }

  for (const [key, value] of Object.entries(raw)) {
    const match = /^filter\[([^\]]+)\]$/.exec(key)
    if (!match) {
      continue
    }
    const name = match[1] as string
    const field = type.fields.find((candidate) => candidate.name === name)
    const text = singleText(value)
    if (text === '') {
      continue
    }
    if (
      !field ||
      !isListFilterField(field) ||
      text === undefined ||
      !isFilterValue(field, text)
    ) {
      invalid.push(key)
      continue
    }
    query.filters = { ...query.filters, [name]: text }
  }

  return { query, invalid }
}

export function adminListQueryKeys(
  query: PlutoAdminListQuery
): Record<string, string> {
  const keys: Record<string, string> = {}
  if (query.search) {
    keys.search = query.search
  }
  if (query.status) {
    keys.status = query.status
  }
  for (const [name, value] of Object.entries(query.filters ?? {})) {
    keys[`filter[${name}]`] = value
  }
  if (query.sort) {
    keys.sort = `${query.sort.direction === 'desc' ? '-' : ''}${query.sort.field}`
  }
  return keys
}

export function isNarrowedListQuery(query: PlutoAdminListQuery): boolean {
  return Boolean(
    query.search || query.status || Object.keys(query.filters ?? {}).length > 0
  )
}

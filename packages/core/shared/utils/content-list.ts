import type {
  PlutoContentItem,
  PlutoContentQuery,
  PlutoContentType,
  PlutoField,
} from '../types/content'
import { isTargetReference } from './content-reference'
import { contentStatusValues } from './content-status'

/**
 * Returns the text that the generic list shows for one field of one item.
 *
 * A field with `listFormat` shows what the formatter returns. A formatter
 * that throws does not break the list: the raw value shows instead. A field
 * with no formatter shows the raw value as text. An empty value is an empty
 * string.
 *
 * This function is pure and has no browser or Nuxt dependency, so it is safe
 * to call on the server too.
 */
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

// The search, the filters and the sort of the admin list. The list page and the admin list route
// use the same rules, so a link with a query (`?search=…&status=draft&sort=-title`) gives the same
// list as the page, and a bad value never reaches the adapter.

/** The longest search text. A longer one is cut. */
export const ADMIN_LIST_SEARCH_MAX = 200

/** The longest filter value (a reference id, an option value). */
const FILTER_VALUE_MAX = 200

/** The field types that sort as a column of the list. */
const SORTABLE_TYPES = new Set<PlutoField['type']>([
  'text',
  'textarea',
  'slug',
  'number',
  'select',
  'boolean',
  'date',
])

/**
 * True when the admin list offers this field as a filter. A `reference` with a `target` filters
 * by default (tags, categories, authors). A `select` and a `boolean` filter by default when they
 * show in the list (`inList`), so a setting such as "Hide from search engines" adds no filter.
 * `filter: true` turns it on for any of them, `filter: false` turns it off.
 */
export function isListFilterField(field: PlutoField): boolean {
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

/** True when the admin list can sort by this column. */
export function isListSortField(field: PlutoField): boolean {
  return (
    field.inList === true &&
    field.sortable !== false &&
    !field.virtual &&
    SORTABLE_TYPES.has(field.type)
  )
}

/** The fields that the admin list offers as filters, in the order of the form. */
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

/** True when `value` is an allowed value of the filter field. */
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

/**
 * The query keys of an admin list query, the reverse of `parseAdminListQuery`: for the list route
 * and for the route query of the page. An empty part has no key.
 */
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

/** True when the query narrows the list: a search, a status or a filter. A sort alone does not. */
export function isNarrowedListQuery(query: PlutoAdminListQuery): boolean {
  return Boolean(
    query.search || query.status || Object.keys(query.filters ?? {}).length > 0
  )
}

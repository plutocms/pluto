import type {
  PlutoPublicIndexType,
  PlutoPublicItem,
  PlutoPublicList,
} from '../types/public-api'
import { PLUTO_API_PREFIX } from './public-api'

/** The path of the public index of a static build. See `PlutoPublicIndex`. */
export const PLUTO_PUBLIC_INDEX_PATH = `${PLUTO_API_PREFIX}/index.json`

const DEFAULT_LIMIT = 20
const MAX_LIMIT = 100
const FILTER_KEY = /^filter\[([^\]]+)\]$/

/**
 * The answer of a list route, from the items of the public index: the same rules as the list of
 * the Git CMS. `search` looks for the text in the title, without case. `filter[field]` compares the
 * text of the value; for an object (a relation that `toPublic` expands, such as
 * `category: { id, label }`), the text of its `id`. `sort` (`field` or `-field`) puts the items with no value last; with no
 * `sort`, the items keep the order of the index (the default sort). Then `offset` and `limit`
 * (1 to 100, default 20). `params` is the URL query, as `plutoPublicQueryParams` gives it.
 */
export function queryPublicIndex<T = PlutoPublicItem>(
  entry: PlutoPublicIndexType,
  params: Record<string, unknown> = {}
): PlutoPublicList<T> {
  let items = [...entry.items]

  const search = text(params.search)?.trim().toLowerCase()
  if (search) {
    items = items.filter((item) =>
      String(item[entry.titleField] ?? '')
        .toLowerCase()
        .includes(search)
    )
  }

  for (const [key, value] of Object.entries(params)) {
    const name = FILTER_KEY.exec(key)?.[1]
    if (name !== undefined) {
      items = items.filter(
        (item) => filterText(item[name]) === String(text(value) ?? '')
      )
    }
  }

  const sort = text(params.sort)?.trim()
  if (sort) {
    const direction = sort.startsWith('-') ? -1 : 1
    const name = sort.replace(/^[-+]/, '')
    items.sort((a, b) => {
      const left = a[name]
      const right = b[name]
      // A missing value always sorts last, in either direction.
      if (isEmpty(left) !== isEmpty(right)) {
        return isEmpty(left) ? 1 : -1
      }
      return (
        compare(left, right) * direction || compare(String(a.id), String(b.id))
      )
    })
  }

  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, whole(params.limit, DEFAULT_LIMIT))
  )
  const offset = whole(params.offset, 0)
  return {
    data: items.slice(offset, offset + limit) as T[],
    meta: { total: items.length, limit, offset },
  }
}

function text(value: unknown): string | undefined {
  const one = Array.isArray(value) ? value[0] : value
  return one === undefined || one === null ? undefined : String(one)
}

/** The text that a filter compares. An object with an `id` compares by its `id`. */
function filterText(value: unknown): string {
  if (value && typeof value === 'object' && 'id' in value) {
    return String(value.id)
  }
  return String(value ?? '')
}

function whole(value: unknown, fallback: number): number {
  const number = Number(text(value))
  return Number.isInteger(number) && number >= 0 ? number : fallback
}

function isEmpty(value: unknown): boolean {
  return value === undefined || value === null || value === ''
}

function compare(a: unknown, b: unknown): number {
  if (typeof a === 'number' && typeof b === 'number') {
    return a - b
  }
  const left = String(a)
  const right = String(b)
  return left < right ? -1 : left > right ? 1 : 0
}

import type { H3Event } from 'h3'
import type {
  PlutoPublicList,
  PlutoPublicOne,
} from '../../shared/types/public-api'
import { setResponseHeader } from 'h3'
import { getPlutoApiConfig } from './pluto-api-config'
import { getContentType } from './pluto-content'
import { requireContentAdapter } from './pluto-content-handlers'
import { createPlutoError } from './pluto-error'
import { markPublicRead } from './pluto-public-read'

/**
 * The logic of the public API (`/api/pluto/v1/content/...`). It is in plain functions, so a test
 * can call it. Every read is a public read: `markPublicRead` runs first, so the adapter answers as
 * for an anonymous visitor, and only published items come out. A type is served only when it sets
 * `api.public`. See the content-model skill.
 */

export const PUBLIC_DEFAULT_LIMIT = 20
export const PUBLIC_MAX_LIMIT = 100
const MAX_SEARCH_LENGTH = 200
const STALE_WHILE_REVALIDATE = 300

/** The timestamps of a public answer, and the key of `timestampKeys` that each one reads. */
const TIMESTAMPS = [
  ['createdAt', 'created'],
  ['updatedAt', 'updated'],
  ['publishedAt', 'published'],
] as const

export interface PublicListQuery {
  limit: number
  offset: number
  search?: string
  sort?: {
    field: string
    direction: 'asc' | 'desc'
  }
  filters?: Record<string, string>
}

function notFound(name: string): Error {
  return createPlutoError({
    statusCode: 404,
    message: `Content type "${name}" not found.`,
    key: 'pluto.errors.contentTypeNotFound',
    params: { name },
  })
}

function invalidQuery(name: string): Error {
  return createPlutoError({
    statusCode: 400,
    message: `The query parameter "${name}" is not valid.`,
    key: 'pluto.errors.invalidQuery',
    params: { name },
  })
}

/** The type, when it is registered and public. A private type answers 404 too, so the API does not tell that it exists. */
export function requirePublicType(name: string): PlutoContentType {
  const type = getContentType(name)
  if (!type || type.api?.public !== true) {
    throw notFound(name)
  }
  return type
}

/** The field names that the public answer has, besides `id` and the timestamps. */
export function publicFieldNames(type: PlutoContentType): string[] {
  const declared = type.fields
    .filter((field) => !field.virtual)
    .map((field) => field.name)
  if (!type.api?.fields) {
    return declared
  }
  return type.api.fields.filter((name) => declared.includes(name))
}

/** The item key of each public timestamp, from the adapter. */
function timestampKeys(
  type: PlutoContentType
): Partial<Record<'createdAt' | 'updatedAt' | 'publishedAt', string>> {
  const keys = requireContentAdapter().timestampKeys?.(type) ?? {}
  const result: Partial<
    Record<'createdAt' | 'updatedAt' | 'publishedAt', string>
  > = {}
  for (const [name, key] of TIMESTAMPS) {
    if (keys[key]) {
      result[name] = keys[key]
    }
  }
  return result
}

/** Reads a whole number from a query value. Anything else gives `fallback`. */
function wholeNumber(value: unknown, fallback: number): number {
  const text = Array.isArray(value) ? value[0] : value
  if (typeof text !== 'string' || !/^\d+$/.test(text)) {
    return fallback
  }
  return Number.parseInt(text, 10)
}

function singleText(value: unknown): string | undefined {
  const text = Array.isArray(value) ? value[0] : value
  return typeof text === 'string' ? text : undefined
}

/**
 * Reads the query of the list route. `limit` is 1 to 100 (default 20) and `offset` is 0 or more; a
 * bad value uses the default. `sort` is `field` or `-field` (descending). `filter[field]=value`
 * filters by equality. A sort or filter on a field that the public answer does not have gives 400.
 */
export function parsePublicQuery(
  type: PlutoContentType,
  query: Record<string, unknown>
): PublicListQuery {
  const fields = publicFieldNames(type)
  const stamps = timestampKeys(type)
  const result: PublicListQuery = {
    limit: Math.min(
      PUBLIC_MAX_LIMIT,
      Math.max(1, wholeNumber(query.limit, PUBLIC_DEFAULT_LIMIT))
    ),
    offset: wholeNumber(query.offset, 0),
  }

  const search = singleText(query.search)?.trim()
  if (search) {
    result.search = search.slice(0, MAX_SEARCH_LENGTH)
  }

  const sort = singleText(query.sort)?.trim()
  if (sort) {
    const direction = sort.startsWith('-') ? 'desc' : 'asc'
    const name = sort.replace(/^[-+]/, '')
    const stamp = stamps[name as keyof typeof stamps]
    if (stamp) {
      result.sort = { field: stamp, direction }
    } else if (fields.includes(name)) {
      result.sort = { field: name, direction }
    } else {
      throw invalidQuery('sort')
    }
  }

  for (const [key, value] of Object.entries(query)) {
    const match = /^filter\[([^\]]+)\]$/.exec(key)
    if (!match) {
      continue
    }
    const name = match[1] as string
    const text = singleText(value)
    if (!fields.includes(name) || text === undefined) {
      throw invalidQuery(key)
    }
    result.filters = { ...result.filters, [name]: text }
  }

  return result
}

/** True when the item is published, or when the type has no publish workflow. */
export function isPublishedItem(
  type: PlutoContentType,
  item: PlutoContentItem
): boolean {
  if (!type.status) {
    return true
  }
  return item.status === (type.status.publishedValue ?? 'published')
}

/** The public answer for one item: the allow-list, then `adapter.toPublic`, then `hooks.toPublic`. */
export async function toPublicData(
  ctx: PlutoContentContext,
  item: PlutoContentItem,
  view: PlutoPublicView,
  batch: PlutoContentItem[] = [item]
): Promise<Record<string, unknown>> {
  let data: Record<string, unknown> = { id: item.id }
  for (const name of publicFieldNames(ctx.type)) {
    if (Object.hasOwn(item, name)) {
      data[name] = item[name]
    }
  }
  for (const [name, key] of Object.entries(timestampKeys(ctx.type))) {
    if (
      key &&
      Object.hasOwn(item, key) &&
      item[key] !== undefined &&
      item[key] !== null
    ) {
      data[name] = item[key]
    }
  }

  const adapter = requireContentAdapter()
  if (adapter.toPublic) {
    data = await adapter.toPublic(ctx, data, { view, item, batch })
  }
  if (ctx.type.hooks?.toPublic) {
    data = await ctx.type.hooks.toPublic(ctx, data, { view, item, batch })
  }
  return data
}

/** Sets the cache header of a public answer. A public answer never sets a cookie. */
export function setPublicApiCache(event: H3Event): void {
  const { maxAge } = getPlutoApiConfig()
  setResponseHeader(
    event,
    'Cache-Control',
    maxAge > 0
      ? `public, s-maxage=${maxAge}, stale-while-revalidate=${STALE_WHILE_REVALIDATE}`
      : 'no-store'
  )
}

/** `GET /api/pluto/v1/content/:type`: the published items of a public type. */
export async function listPublicContent(
  event: H3Event,
  typeName: string,
  rawQuery: Record<string, unknown>
): Promise<PlutoPublicList> {
  markPublicRead(event)
  const type = requirePublicType(typeName)
  const query = parsePublicQuery(type, rawQuery)
  const ctx = { event, type }

  const result = await requireContentAdapter().list(ctx, {
    limit: query.limit,
    offset: query.offset,
    search: query.search,
    sort: query.sort ?? type.defaultSort,
    filters: query.filters,
    includeUnpublished: false,
  })

  // The adapter filters drafts already. This check makes sure that no adapter can leak one.
  const items = result.data.filter((item) => isPublishedItem(type, item))
  const data = await Promise.all(
    items.map((item) => toPublicData(ctx, item, 'list', items))
  )

  setPublicApiCache(event)
  return {
    data: data as PlutoPublicList['data'],
    meta: {
      total: result.total ?? data.length,
      limit: query.limit,
      offset: query.offset,
    },
  }
}

/** `GET /api/pluto/v1/content/:type/:id`: one published item, by id or slug. */
export async function getPublicContent(
  event: H3Event,
  typeName: string,
  idOrSlug: string
): Promise<PlutoPublicOne> {
  markPublicRead(event)
  const type = requirePublicType(typeName)
  const ctx = { event, type }

  const item =
    idOrSlug === '' ? null : await requireContentAdapter().get(ctx, idOrSlug)
  if (!item || !isPublishedItem(type, item)) {
    throw createPlutoError({
      statusCode: 404,
      message: 'Not found.',
      key: 'pluto.errors.notFound',
    })
  }

  const data = await toPublicData(ctx, item, 'item')
  setPublicApiCache(event)
  return { data: data as PlutoPublicOne['data'] }
}

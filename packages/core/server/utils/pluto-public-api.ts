import type { H3Event } from 'h3'
import type {
  PlutoPublicIndex,
  PlutoPublicItem,
  PlutoPublicList,
  PlutoPublicOne,
  PlutoPublicSurround,
} from '../../shared/types/public-api'
import { setResponseHeader } from 'h3'
import { getPlutoApiConfig } from './pluto-api-config'
import { getContentType, listContentTypes } from './pluto-content'
import { requireContentAdapter } from './pluto-content-handlers'
import { createPlutoError } from './pluto-error'
import { expandPublicMedia } from './pluto-media-public'
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

  // The ids of the `media` fields become the records of the files.
  data = await expandPublicMedia(ctx.event, ctx.type, data, batch)

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

/**
 * The public index of a static build (`PlutoPublicIndex`): every published item of every public
 * type, in the list shape and in the default sort. The prerender writes it to
 * `/api/pluto/v1/index.json`, and the list composables of the browser answer from it.
 */
export async function buildPublicIndex(
  event: H3Event
): Promise<PlutoPublicIndex> {
  const index: PlutoPublicIndex = { types: {} }
  for (const type of listContentTypes()) {
    if (type.api?.public !== true) {
      continue
    }
    const items: PlutoPublicItem[] = []
    let total = Infinity
    while (items.length < total) {
      // The query of a URL: text values.
      const page = await listPublicContent(event, type.name, {
        limit: String(PUBLIC_MAX_LIMIT),
        offset: String(items.length),
      })
      items.push(...page.data)
      total = page.data.length > 0 ? page.meta.total : items.length
    }
    index.types[type.name] = { titleField: type.titleField, items }
  }
  return index
}

/**
 * True when the caller may read the drafts of the type: the adapter says the caller holds the read
 * capability of the type (else its write capability). Fails closed: no capability to check, no
 * `authorize`, or no session gives false.
 */
async function canReadDrafts(
  event: H3Event,
  type: PlutoContentType
): Promise<boolean> {
  const capability = type.capabilities?.read ?? type.capabilities?.write
  const adapter = requireContentAdapter()
  if (!capability || !adapter.authorize) {
    return false
  }
  try {
    await adapter.authorize(event, capability)
    return true
  } catch {
    return false
  }
}

/**
 * `GET /api/pluto/v1/content/:type/:id`: one published item, by id or slug. With `drafts`
 * (`?drafts=1`), an editor of the type (`canReadDrafts`) also gets a draft, marked with
 * `meta.draft`, and the answer is private (`no-store`). For anyone else `drafts` changes nothing.
 */
export async function getPublicContent(
  event: H3Event,
  typeName: string,
  idOrSlug: string,
  options: {
    drafts?: boolean
  } = {}
): Promise<PlutoPublicOne> {
  const type = requirePublicType(typeName)
  const drafts = options.drafts === true && (await canReadDrafts(event, type))
  if (!drafts) {
    markPublicRead(event)
  }
  const ctx = { event, type }

  const item =
    idOrSlug === '' ? null : await requireContentAdapter().get(ctx, idOrSlug)
  const published = item ? isPublishedItem(type, item) : false
  if (!item || (!published && !drafts)) {
    throw createPlutoError({
      statusCode: 404,
      message: 'Not found.',
      key: 'pluto.errors.notFound',
    })
  }

  const data = await toPublicData(ctx, item, 'item')
  if (drafts) {
    setResponseHeader(event, 'Cache-Control', 'private, no-store')
  } else {
    setPublicApiCache(event)
  }
  return {
    data: data as PlutoPublicOne['data'],
    ...(!published && { meta: { draft: true } }),
  }
}

/** The most published items that `getPublicSurround` reads to find the neighbors. */
export const PUBLIC_SURROUND_MAX = 1000

/**
 * `GET /api/pluto/v1/surround/:type/:id`: the published items before and after one item, in the
 * order of `sort` (default: the `defaultSort` of the type), with the same `filter` as a list.
 * For a list sorted by `-publishedAt`, `previous` is the newer item and `next` the older one. It
 * reads at most `PUBLIC_SURROUND_MAX` items. 404 when the item is not among them.
 */
export async function getPublicSurround(
  event: H3Event,
  typeName: string,
  idOrSlug: string,
  rawQuery: Record<string, unknown>
): Promise<PlutoPublicOne<PlutoPublicSurround>> {
  markPublicRead(event)
  const type = requirePublicType(typeName)
  const query = parsePublicQuery(type, rawQuery)
  const ctx = { event, type }
  const adapter = requireContentAdapter()

  const items: PlutoContentItem[] = []
  for (let offset = 0; offset < PUBLIC_SURROUND_MAX; offset += PUBLIC_MAX_LIMIT) {
    const page = await adapter.list(ctx, {
      limit: PUBLIC_MAX_LIMIT,
      offset,
      sort: query.sort ?? type.defaultSort,
      filters: query.filters,
      includeUnpublished: false,
    })
    items.push(...page.data.filter((item) => isPublishedItem(type, item)))
    if (page.data.length < PUBLIC_MAX_LIMIT) {
      break
    }
  }

  const slugField = type.slug ? type.slug.field : undefined
  const index = items.findIndex(
    (item) =>
      String(item.id) === idOrSlug ||
      (slugField !== undefined && String(item[slugField]) === idOrSlug)
  )
  if (index === -1) {
    throw createPlutoError({
      statusCode: 404,
      message: 'Not found.',
      key: 'pluto.errors.notFound',
    })
  }

  const previous = items[index - 1]
  const next = items[index + 1]
  const batch = [previous, next].filter(
    (item): item is PlutoContentItem => Boolean(item)
  )
  const [previousData, nextData] = await Promise.all([
    previous ? toPublicData(ctx, previous, 'list', batch) : null,
    next ? toPublicData(ctx, next, 'list', batch) : null,
  ])
  setPublicApiCache(event)
  return {
    data: {
      previous: (previousData as PlutoPublicItem | null) ?? null,
      next: (nextData as PlutoPublicItem | null) ?? null,
    },
  }
}

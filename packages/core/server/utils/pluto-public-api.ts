import type { H3Event } from 'h3'
import type {
  PlutoPublicIndex,
  PlutoPublicItem,
  PlutoPublicList,
  PlutoPublicOne,
  PlutoPublicSurround,
} from '../../shared/types/public-api'
import { setResponseHeader } from 'h3'
import { withStandardPublicKeys } from '../../shared/utils/content-standard'
import { isLiveItem } from '../../shared/utils/content-status'
import { getPlutoApiConfig } from './pluto-api-config'
import { getContentType, listContentTypes } from './pluto-content'
import { requireContentAdapter } from './pluto-content-handlers'
import { createPlutoError } from './pluto-error'
import { highlightPlutoHtml } from './pluto-highlight'
import { expandPublicMedia } from './pluto-media-public'
import { markPublicRead } from './pluto-public-read'
import {
  expandPublicReferences,
  resolveReferenceFilters,
} from './pluto-reference-public'

export const PUBLIC_DEFAULT_LIMIT = 20
export const PUBLIC_MAX_LIMIT = 100
const MAX_SEARCH_LENGTH = 200
const STALE_WHILE_REVALIDATE = 300

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

// A private type answers 404 too, so the API does not tell that it exists.
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

export function requirePublicType(name: string): PlutoContentType {
  const type = getContentType(name)
  if (!type || type.api?.public !== true) {
    throw notFound(name)
  }
  return type
}

export function publicFieldNames(type: PlutoContentType): string[] {
  const declared = type.fields
    .filter((field) => !field.virtual)
    .map((field) => field.name)
  if (!type.api?.fields) {
    return declared
  }
  return type.api.fields.filter((name) => declared.includes(name))
}

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

export function isPublishedItem(
  type: PlutoContentType,
  item: PlutoContentItem
): boolean {
  return isLiveItem(type, item)
}

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

  data = await expandPublicMedia(ctx.event, ctx.type, data, batch)
  data = await expandPublicReferences(ctx.event, ctx.type, data, batch)

  const adapter = requireContentAdapter()
  if (adapter.toPublic) {
    data = await adapter.toPublic(ctx, data, { view, item, batch })
  }
  data = withStandardPublicKeys(ctx.type, data, item)
  if (ctx.type.hooks?.toPublic) {
    data = await ctx.type.hooks.toPublic(ctx, data, { view, item, batch })
  }
  if (view === 'item' && typeof data.html === 'string') {
    data.html = await highlightPlutoHtml(
      data.html,
      getPlutoApiConfig().highlighter
    )
  }
  return data
}

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

export async function listPublicContent(
  event: H3Event,
  typeName: string,
  rawQuery: Record<string, unknown>
): Promise<PlutoPublicList> {
  markPublicRead(event)
  const type = requirePublicType(typeName)
  const query = parsePublicQuery(type, rawQuery)
  const ctx = { event, type }

  const { filters, empty } = await resolveReferenceFilters(
    event,
    type,
    query.filters
  )
  if (empty) {
    setPublicApiCache(event)
    return {
      data: [],
      meta: { total: 0, limit: query.limit, offset: query.offset },
    }
  }

  const result = await requireContentAdapter().list(ctx, {
    limit: query.limit,
    offset: query.offset,
    search: query.search,
    sort: query.sort ?? type.defaultSort,
    filters,
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

export const PUBLIC_SURROUND_MAX = 1000

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

  const { filters, empty } = await resolveReferenceFilters(
    event,
    type,
    query.filters
  )
  if (empty) {
    throw createPlutoError({
      statusCode: 404,
      message: 'Not found.',
      key: 'pluto.errors.notFound',
    })
  }

  const items: PlutoContentItem[] = []
  for (
    let offset = 0;
    offset < PUBLIC_SURROUND_MAX;
    offset += PUBLIC_MAX_LIMIT
  ) {
    const page = await adapter.list(ctx, {
      limit: PUBLIC_MAX_LIMIT,
      offset,
      sort: query.sort ?? type.defaultSort,
      filters,
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
  const batch = [previous, next].filter((item): item is PlutoContentItem =>
    Boolean(item)
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

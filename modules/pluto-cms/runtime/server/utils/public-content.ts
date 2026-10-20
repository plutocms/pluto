import type { H3Event } from 'h3'
import type { PlutoContentItem, PlutoContentType } from '../../../../../shared/types/content'
import type { PlutoCmsItem, PlutoCmsListItem, PlutoCmsListResult } from '../../shared/public-types'
import { setResponseHeader } from 'h3'
import { requireContentAdapter, requireContentType } from '../../../../../server/utils/pluto-content-handlers'
import { createPlutoError } from '../../../../../server/utils/pluto-error'
import { getCmsConfig } from './cms-config'
import { assertSafeSlug } from './cms-paths'
import { getRegisteredCmsCache, markCmsAnonymous } from './cms-setup'
import { markdownToPlainText, renderMarkdown } from './markdown'

/**
 * The logic of the public read routes. It is in plain functions, so a test
 * can call it. A public read is always anonymous: `markCmsAnonymous` runs
 * first, so the session cookie is never read, drafts never show, and the
 * response never sets a cookie. The same URL gives the same answer for every
 * visitor, so a CDN may cache it.
 */

export const DEFAULT_LIMIT = 20
export const MAX_LIMIT = 100
const EXCERPT_LENGTH = 200
const STALE_WHILE_REVALIDATE = 300

/** Reads a whole number from a query value. Anything else gives `fallback`. */
function wholeNumber(value: unknown, fallback: number): number {
  const text = Array.isArray(value) ? value[0] : value
  if (typeof text !== 'string' || !/^\d+$/.test(text)) {
    return fallback
  }
  return Number.parseInt(text, 10)
}

/** `limit` is 1 to 100 (default 20). `offset` is 0 or more. A bad value uses the default. */
export function parsePaging(query: Record<string, unknown>): {
 limit: number
offset: number
} {
  const limit = wholeNumber(query.limit, DEFAULT_LIMIT)
  return {
    limit: Math.min(MAX_LIMIT, Math.max(1, limit)),
    offset: wholeNumber(query.offset, 0),
  }
}

/** Sets the CDN cache header. A public response never sets a cookie. */
export function setPublicCacheHeaders(event: H3Event): void {
  const { publicMaxAge } = getCmsConfig()
  setResponseHeader(event, 'Cache-Control', `public, s-maxage=${publicMaxAge}, stale-while-revalidate=${STALE_WHILE_REVALIDATE}`)
}

function bodyFieldName(type: PlutoContentType): string | undefined {
  return type.fields.find((field) => field.type === 'richtext')?.name
}

/** The body of an item as Markdown text. */
function bodyOf(type: PlutoContentType, item: PlutoContentItem): string {
  const name = bodyFieldName(type)
  const value = name ? item[name] : undefined
  return typeof value === 'string' ? value : ''
}

function badSlugError(): Error {
  return createPlutoError({
    statusCode: 400,
    message: 'The slug is not valid.',
    key: 'pluto.cms.errors.invalidSlug',
  })
}

function notFoundError(): Error {
  return createPlutoError({ statusCode: 404, message: 'Not found.', key: 'pluto.errors.notFound' })
}

/** The type must be registered. A bad name gives 404. */
function requireType(typeName: string): PlutoContentType {
  return requireContentType(typeName)
}

/**
 * Keeps a derived text in the cache by the blob id of the file. A blob id
 * never changes, so the entry never goes stale. Without a blob id, nothing is cached.
 */
async function cachedByBlob(prefix: string, oid: string | undefined, loader: () => string): Promise<string> {
  if (!oid) {
    return loader()
  }
  const cache = getRegisteredCmsCache()
  const key = `${prefix}:${oid}`
  const cached = await cache.getBlob<string>(key)
  if (typeof cached === 'string') {
    return cached
  }
  const value = loader()
  await cache.setBlob(key, value)
  return value
}

async function excerptOf(type: PlutoContentType, item: PlutoContentItem, event: H3Event): Promise<string> {
  const own = item.excerpt
  if (typeof own === 'string' && own.trim() !== '') {
    return own.trim()
  }
  // A list item has no body. Read the file. The adapter has it in its cache.
  const full = await requireContentAdapter().get({ event, type }, String(item.id))
  if (!full) {
    return ''
  }
  const body = bodyOf(type, full)
  if (!body) {
    return ''
  }
  return cachedByBlob('excerpt', full._version, () => markdownToPlainText(body, EXCERPT_LENGTH))
}

/** The published items of a type, without the body, each with an `excerpt`. */
export async function listPublicItems(
  event: H3Event,
  typeName: string,
  query: Record<string, unknown>
): Promise<PlutoCmsListResult> {
  markCmsAnonymous(event)
  const type = requireType(typeName)
  const { limit, offset } = parsePaging(query)

  const result = await requireContentAdapter().list({ event, type }, {
    limit,
    offset,
    sort: type.defaultSort,
    includeUnpublished: false,
  })

  const data = await Promise.all(result.data.map(async (item) => {
    const row: PlutoContentItem = { ...item }
    const bodyName = bodyFieldName(type)
    if (bodyName) {
      delete row[bodyName]
    }
    return { ...row, id: String(item.id), excerpt: await excerptOf(type, item, event) } as PlutoCmsListItem
  }))

  return { data, total: result.total ?? data.length, limit, offset }
}

/** One published item with its body as sanitized HTML. */
export async function getPublicItem(event: H3Event, typeName: string, slug: string): Promise<PlutoCmsItem> {
  markCmsAnonymous(event)
  const type = requireType(typeName)
  try {
    assertSafeSlug(slug)
  } catch {
    throw badSlugError()
  }

  const item = await requireContentAdapter().get({ event, type }, slug)
  if (!item) {
    throw notFoundError()
  }

  const body = bodyOf(type, item)
  const html = body ? await cachedByBlob('html', item._version, () => renderMarkdown(body)) : ''
  return { ...item, id: String(item.id), html }
}

import type { H3Event } from 'h3'
import type { PlutoAdminListQuery } from '../../shared/utils/content-list'
import {
  backupFields,
  parseBackup,
  PLUTO_BACKUP_MAX_CHARS,
  PLUTO_BACKUP_TTL_MS,
} from '../../shared/utils/content-backup'
import { statusRules } from '../../shared/utils/content-status'
import { validateContentPayload } from '../../shared/utils/content-validate'
import {
  getContentAdapter,
  getContentType,
  listContentTypes,
} from './pluto-content'
import { createPlutoError } from './pluto-error'
import { createPlutoSystemEvent } from './pluto-system'

const NEW_BACKUP_KEY = '+new'

export function requireContentType(name: string): PlutoContentType {
  const type = getContentType(name)

  if (!type) {
    throw createPlutoError({
      statusCode: 404,
      message: `Content type "${name}" not found.`,
      key: 'pluto.errors.contentTypeNotFound',
      params: { name },
    })
  }

  return type
}

export function requireContentAdapter(): PlutoContentAdapter {
  const adapter = getContentAdapter()

  if (!adapter) {
    throw createPlutoError({
      statusCode: 500,
      message: 'No content adapter is registered.',
      key: 'pluto.errors.noContentAdapter',
    })
  }

  return adapter
}

export async function authorizeContentOperation(
  event: H3Event,
  capability: string | undefined
): Promise<void> {
  if (!capability) {
    return
  }

  const adapter = requireContentAdapter()

  if (!adapter.authorize) {
    return
  }

  await adapter.authorize(event, capability)
}

// No read capability check here: the adapter decides what an anonymous caller sees.
export async function listContentItems(
  ctx: PlutoContentContext,
  query: PlutoAdminListQuery & {
    limit?: number
    offset?: number
    published?: boolean
  }
): Promise<PlutoContentListResult> {
  if (query.published !== true) {
    await publishDueOnOpen(ctx)
  }
  return requireContentAdapter().list(ctx, {
    limit: query.limit,
    offset: query.offset,
    search: query.search,
    sort: query.sort ?? ctx.type.defaultSort,
    filters: query.filters,
    status: query.status,
    includeUnpublished: query.published !== true,
  })
}

async function publishDueOnOpen(ctx: PlutoContentContext): Promise<void> {
  const adapter = requireContentAdapter()
  if (!adapter.publishDue || !statusRules(ctx.type)?.scheduled) {
    return
  }
  try {
    await authorizeContentOperation(
      ctx.event,
      ctx.type.capabilities?.publish ?? ctx.type.capabilities?.write
    )
  } catch {
    return
  }
  try {
    await adapter.publishDue(ctx, new Date().toISOString())
  } catch (error) {
    console.warn(
      `[pluto] The publish of the scheduled "${ctx.type.name}" items failed: ${(error as Error).message}`
    )
  }
}

export async function getContentItem(
  ctx: PlutoContentContext,
  idOrSlug: string | number
): Promise<PlutoContentItem> {
  const item = await requireContentAdapter().get(ctx, idOrSlug)

  if (!item) {
    throw createPlutoError({
      statusCode: 404,
      message: 'Not found.',
      key: 'pluto.errors.notFound',
    })
  }

  return item
}

function requirePlainObjectBody(body: unknown): Record<string, unknown> {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw createPlutoError({
      statusCode: 400,
      message: 'Request body must be a JSON object.',
      key: 'pluto.errors.bodyNotObject',
    })
  }

  return body as Record<string, unknown>
}

export async function removeBackupQuietly(
  ctx: PlutoContentContext,
  key: string
): Promise<void> {
  try {
    await getContentAdapter()?.backups?.remove(ctx, key)
  } catch (error) {
    console.warn(
      `[pluto] Could not remove the backup of "${ctx.type.name}" "${key}".`,
      error
    )
  }
}

export async function createContentItem(
  ctx: PlutoContentContext,
  body: unknown
): Promise<PlutoContentItem> {
  const payload = requirePlainObjectBody(body)

  const errors = validateContentPayload(ctx.type, payload)
  if (errors.length > 0) {
    throw createPlutoError({
      statusCode: 400,
      message: 'Validation failed.',
      key: 'pluto.errors.validationFailed',
      data: { errors },
    })
  }

  await authorizeContentOperation(ctx.event, ctx.type.capabilities?.write)

  if (ctx.type.singleton) {
    const existing = await requireContentAdapter().list(ctx, {
      limit: 1,
      offset: 0,
      includeUnpublished: true,
    })
    if (existing.data.length > 0 || (existing.total ?? 0) > 0) {
      throw createPlutoError({
        statusCode: 409,
        message: 'The singleton item exists already.',
        key: 'pluto.errors.singletonExists',
      })
    }
  }

  const item = await requireContentAdapter().create(ctx, payload)
  await removeBackupQuietly(ctx, NEW_BACKUP_KEY)

  if (ctx.type.hooks?.afterCreate) {
    await ctx.type.hooks.afterCreate(ctx, item, payload)
  }

  return item
}

export async function updateContentItem(
  ctx: PlutoContentContext,
  id: string | number,
  body: unknown
): Promise<PlutoContentItem> {
  const payload = requirePlainObjectBody(body)

  const errors = validateContentPayload(ctx.type, payload, { partial: true })
  if (errors.length > 0) {
    throw createPlutoError({
      statusCode: 400,
      message: 'Validation failed.',
      key: 'pluto.errors.validationFailed',
      data: { errors },
    })
  }

  await authorizeContentOperation(ctx.event, ctx.type.capabilities?.write)

  const item = await requireContentAdapter().update(ctx, id, payload)
  await removeBackupQuietly(ctx, String(id))

  if (ctx.type.hooks?.afterUpdate) {
    await ctx.type.hooks.afterUpdate(ctx, item, payload)
  }

  return item
}

export async function deleteContentItem(
  ctx: PlutoContentContext,
  id: string | number
): Promise<void> {
  if (ctx.type.singleton) {
    throw createPlutoError({
      statusCode: 400,
      message: 'The singleton item cannot be deleted.',
      key: 'pluto.errors.singletonDelete',
    })
  }

  await authorizeContentOperation(ctx.event, ctx.type.capabilities?.delete)

  const adapter = requireContentAdapter()
  if (ctx.type.trash && adapter.trash) {
    await adapter.trash.move(ctx, id)
  } else {
    await adapter.remove(ctx, id)
  }
  await removeBackupQuietly(ctx, String(id))
}

export const PLUTO_TRASH_DAYS = 30

export function trashCutoff(now: Date = new Date()): string {
  return new Date(
    now.getTime() - PLUTO_TRASH_DAYS * 24 * 60 * 60 * 1000
  ).toISOString()
}

function requireTrash(
  ctx: PlutoContentContext
): NonNullable<PlutoContentAdapter['trash']> {
  if (!ctx.type.trash) {
    throw createPlutoError({
      statusCode: 404,
      message: 'This content type has no trash.',
      key: 'pluto.errors.noTrash',
    })
  }
  const trash = requireContentAdapter().trash
  if (!trash) {
    throw createPlutoError({
      statusCode: 501,
      message: 'The content adapter has no trash.',
      key: 'pluto.errors.noTrashAdapter',
    })
  }
  return trash
}

export async function listTrashItems(
  ctx: PlutoContentContext,
  query: {
    limit?: number
    offset?: number
    search?: string
  }
): Promise<PlutoContentListResult> {
  await authorizeContentOperation(ctx.event, ctx.type.capabilities?.delete)
  const trash = requireTrash(ctx)
  try {
    await trash.purgeBefore(ctx, trashCutoff())
  } catch (error) {
    console.warn(
      `[pluto] The purge of the trash of "${ctx.type.name}" failed: ${(error as Error).message}`
    )
  }
  return trash.list(ctx, query)
}

export async function purgeExpiredTrash(
  now: Date = new Date()
): Promise<{ purged: number; failed: string[] }> {
  const trash = getContentAdapter()?.trash
  const result = { purged: 0, failed: [] as string[] }
  if (!trash) {
    return result
  }
  const event = createPlutoSystemEvent()
  for (const type of listContentTypes().filter((one) => one.trash)) {
    try {
      result.purged += await trash.purgeBefore(
        { event, type },
        trashCutoff(now)
      )
    } catch (error) {
      result.failed.push(type.name)
      console.warn(
        `[pluto] The scheduled purge of the trash of "${type.name}" failed: ${(error as Error).message}`
      )
    }
  }
  return result
}

export async function publishScheduledContent(
  now: Date = new Date()
): Promise<{ published: number; failed: string[] }> {
  const adapter = getContentAdapter()
  const result = { published: 0, failed: [] as string[] }
  if (!adapter?.publishDue) {
    return result
  }
  const event = createPlutoSystemEvent()
  for (const type of listContentTypes().filter(
    (one) => statusRules(one)?.scheduled
  )) {
    try {
      result.published += await adapter.publishDue(
        { event, type },
        now.toISOString()
      )
    } catch (error) {
      result.failed.push(type.name)
      console.warn(
        `[pluto] The scheduled publish of "${type.name}" failed: ${(error as Error).message}`
      )
    }
  }
  return result
}

export async function restoreTrashItem(
  ctx: PlutoContentContext,
  id: string | number
): Promise<PlutoContentItem> {
  await authorizeContentOperation(ctx.event, ctx.type.capabilities?.delete)
  return requireTrash(ctx).restore(ctx, id)
}

export async function purgeTrashItem(
  ctx: PlutoContentContext,
  id: string | number
): Promise<void> {
  await authorizeContentOperation(ctx.event, ctx.type.capabilities?.delete)
  await requireTrash(ctx).purge(ctx, id)
}

export async function emptyTrash(
  ctx: PlutoContentContext,
  now: Date = new Date()
): Promise<{ purged: number }> {
  await authorizeContentOperation(ctx.event, ctx.type.capabilities?.delete)
  const purged = await requireTrash(ctx).purgeBefore(
    ctx,
    new Date(now.getTime() + 1000).toISOString()
  )
  return { purged }
}

export const CONTENT_ACTIVITY_MAX_WEEKS = 52

function startOfWeekUtc(date: Date): Date {
  const start = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  )
  const daysSinceMonday = (start.getUTCDay() + 6) % 7
  start.setUTCDate(start.getUTCDate() - daysSinceMonday)
  return start
}

export async function contentActivity(
  ctx: PlutoContentContext,
  options: {
    weeks: number
    now?: Date
  }
): Promise<PlutoContentActivity> {
  const adapter = requireContentAdapter()
  const unsupported: PlutoContentActivity = {
    supported: false,
    interval: 'week',
    points: [],
  }

  if (!adapter.countCreated) {
    return unsupported
  }

  const weeks = Math.min(
    CONTENT_ACTIVITY_MAX_WEEKS,
    Math.max(1, Math.trunc(options.weeks))
  )
  const thisWeek = startOfWeekUtc(options.now ?? new Date())
  const DAY = 24 * 60 * 60 * 1000

  const ranges = Array.from({ length: weeks }, (_, index) => {
    const from = new Date(thisWeek.getTime() - (weeks - 1 - index) * 7 * DAY)
    const to = new Date(from.getTime() + 7 * DAY)
    return { from: from.toISOString(), to: to.toISOString() }
  })

  const counts = await Promise.all(
    ranges.map((range) => adapter.countCreated!(ctx, range))
  )

  if (counts.includes(null)) {
    return unsupported
  }

  return {
    supported: true,
    interval: 'week',
    points: ranges.map((range, index) => ({
      start: range.from.slice(0, 10),
      count: counts[index] as number,
    })),
  }
}

export const CONTENT_REVISIONS_MAX_LIMIT = 50

async function authorizeRevisions(ctx: PlutoContentContext): Promise<void> {
  await authorizeContentOperation(ctx.event, ctx.type.capabilities?.write)
}

export async function listContentRevisions(
  ctx: PlutoContentContext,
  id: string | number,
  query: {
    limit?: number
    cursor?: string
  } = {}
): Promise<PlutoContentRevisionList> {
  const adapter = requireContentAdapter()
  if (!adapter.listRevisions || !adapter.getRevision) {
    return { supported: false, data: [] }
  }
  await authorizeRevisions(ctx)
  const limit = Math.min(
    CONTENT_REVISIONS_MAX_LIMIT,
    Math.max(1, Math.trunc(query.limit ?? 20) || 20)
  )
  const page = await adapter.listRevisions(ctx, id, {
    limit,
    ...(query.cursor && { cursor: query.cursor }),
  })
  return { supported: true, ...page }
}

export async function getContentRevision(
  ctx: PlutoContentContext,
  id: string | number,
  revisionId: string
): Promise<PlutoContentItem> {
  const adapter = requireContentAdapter()
  if (!adapter.getRevision) {
    throw createPlutoError({
      statusCode: 404,
      message: 'This site keeps no revisions.',
      key: 'pluto.errors.notFound',
    })
  }
  await authorizeRevisions(ctx)
  const item = await adapter.getRevision(ctx, id, revisionId)
  if (!item) {
    throw createPlutoError({
      statusCode: 404,
      message: 'Not found.',
      key: 'pluto.errors.notFound',
    })
  }
  return item
}

async function authorizeBackup(ctx: PlutoContentContext): Promise<void> {
  await authorizeContentOperation(ctx.event, ctx.type.capabilities?.write)
}

function backupKeyOf(id: string | undefined): string {
  return id || NEW_BACKUP_KEY
}

export async function getContentBackup(
  ctx: PlutoContentContext,
  id?: string
): Promise<PlutoContentBackupAnswer> {
  const backups = requireContentAdapter().backups
  if (!backups) {
    return { supported: false }
  }
  await authorizeBackup(ctx)
  return { supported: true, backup: await backups.get(ctx, backupKeyOf(id)) }
}

export async function putContentBackup(
  ctx: PlutoContentContext,
  id: string | undefined,
  body: string | undefined
): Promise<PlutoContentBackupAnswer> {
  const backups = requireContentAdapter().backups
  if (!backups) {
    return { supported: false }
  }
  await authorizeBackup(ctx)

  const text = body ?? ''
  if (text.length > PLUTO_BACKUP_MAX_CHARS) {
    throw createPlutoError({
      statusCode: 413,
      message: 'The backup is too large.',
      key: 'pluto.errors.backupTooLarge',
    })
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    parsed = undefined
  }
  const record = parseBackup(parsed, {
    now: Date.now(),
    ttlMs: PLUTO_BACKUP_TTL_MS,
    fields: backupFields(ctx.type),
  })
  if (!record) {
    throw createPlutoError({
      statusCode: 400,
      message: 'The backup is not valid.',
      key: 'pluto.errors.backupInvalid',
    })
  }

  const { otherDevice } = await backups.put(ctx, backupKeyOf(id), record)
  return { supported: true, otherDevice }
}

export async function removeContentBackup(
  ctx: PlutoContentContext,
  id?: string
): Promise<PlutoContentBackupAnswer> {
  const backups = requireContentAdapter().backups
  if (!backups) {
    return { supported: false }
  }
  await authorizeBackup(ctx)
  await backups.remove(ctx, backupKeyOf(id))
  return { supported: true }
}

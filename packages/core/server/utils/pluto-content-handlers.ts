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

/**
 * The real logic behind the generic content routes, kept in plain exported
 * functions — not inline in a `server/api/**` route file — so it can be
 * unit-tested by calling it directly, the same way this workspace already
 * tests everything else: no live Nitro server, no `@nuxt/test-utils`.
 */

/** The key of the server copy of a new item. */
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

/**
 * Checks `capability` against `event`, but only when there is something to
 * check against. Exported because both write handlers below share it, and
 * a test exercises it indirectly through them.
 *
 * Fails open on purpose, in two cases:
 * - `capability` is undefined (the content type declares no capability for
 *   this operation): nothing to enforce, anyone who can reach the route
 *   may proceed.
 * - The registered adapter has no `authorize` method: the same fail-open
 *   rule `usePlutoPermissions().can()` already documents for "no
 *   permissions backend registered at all" — with no boundary to enforce,
 *   the adapter's own backing store (RLS, or equivalent) is still the real
 *   gate.
 */
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

/**
 * Lists items for `ctx.type`. Never checks `type.capabilities.read` and
 * never calls `adapter.authorize` — see the content-model skill for why:
 * in short, "read" is not all-or-nothing for a type like `posts` (an
 * anonymous visitor can read published posts; only drafts need a
 * capability), and that distinction already lives in the adapter's backing
 * store (RLS, for the one adapter that exists so far). This route always
 * asks the adapter for everything, unfiltered by capability, because it is
 * admin-surface-only in intent — a public-facing read path is a layer's
 * own hand-written endpoint, not this generic one.
 *
 * `published: true` narrows the result to published rows. The dashboard
 * uses it, with `limit: 1`, to count published rows next to the total.
 * It only narrows the result, so it needs no capability check either.
 */
export async function listContentItems(
  ctx: PlutoContentContext,
  query: PlutoAdminListQuery & {
    limit?: number
    offset?: number
    published?: boolean
  }
): Promise<PlutoContentListResult> {
  // The admin list of a publisher publishes the due items first: a host with no scheduled task
  // (Vercel with Nitro 2, Netlify) still gets a right status. The dashboard count does not.
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
    // A status filter can ask for a draft, so it needs the unpublished rows.
    includeUnpublished: query.published !== true,
  })
}

/**
 * Publishes the scheduled items of the type whose time has come, when the caller can publish.
 * A caller without the publish capability only reads. A failure only warns: the list still loads.
 */
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

/** Gets one item by id or slug. No capability check — see `listContentItems`. */
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

/**
 * Removes the server copy of the caller after a save or a delete worked. It does nothing when the
 * adapter keeps no copies. A copy that stays is harmless, so an error only warns: it never fails the
 * save. `key` is the item id as text, or '+new'.
 */
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

/**
 * Creates one item. Validates the full payload (not partial), authorizes
 * against `type.capabilities.write`, then calls the adapter, then runs
 * `type.hooks.afterCreate` when one is registered. A hook error propagates
 * — it is not swallowed.
 */
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

  const item = await requireContentAdapter().create(ctx, payload)
  await removeBackupQuietly(ctx, NEW_BACKUP_KEY)

  if (ctx.type.hooks?.afterCreate) {
    await ctx.type.hooks.afterCreate(ctx, item, payload)
  }

  return item
}

/**
 * Updates one item. Validates the payload as a partial update, authorizes
 * against `type.capabilities.write`, then calls the adapter, then runs
 * `type.hooks.afterUpdate` when one is registered. A hook error propagates
 * — it is not swallowed.
 */
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

/** Deletes one item. Authorizes against `type.capabilities.delete` before calling the adapter. */
export async function deleteContentItem(
  ctx: PlutoContentContext,
  id: string | number
): Promise<void> {
  await authorizeContentOperation(ctx.event, ctx.type.capabilities?.delete)

  // A type with a trash moves the item there. Without one, the delete is final.
  const adapter = requireContentAdapter()
  if (ctx.type.trash && adapter.trash) {
    await adapter.trash.move(ctx, id)
  } else {
    await adapter.remove(ctx, id)
  }
  await removeBackupQuietly(ctx, String(id))
}

/** The days that an item stays in the trash. Then the purge deletes it. */
export const PLUTO_TRASH_DAYS = 30

/** The time before which a trashed item is old enough for the purge (ISO). */
export function trashCutoff(now: Date = new Date()): string {
  return new Date(
    now.getTime() - PLUTO_TRASH_DAYS * 24 * 60 * 60 * 1000
  ).toISOString()
}

/** The trash of the adapter, for a type with `trash`. 404 without it on the type, 501 on the adapter. */
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

/**
 * The trashed items of a type, the last trashed first. It purges the items older than
 * `PLUTO_TRASH_DAYS` first, so a host with no scheduled task purges too. A failed purge only
 * warns. Needs the delete capability.
 */
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

/**
 * Purges the expired items of every type with `trash`, as a system request. The scheduled task
 * `pluto:trash:purge` calls it. A type that fails (no server credentials, an outage) only warns.
 */
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

/**
 * Publishes the scheduled items whose time has come, for every content type with
 * `status.schedule`, with a system request. The scheduled task `pluto:publish:scheduled` calls it.
 * A failed type only warns, so the other types still publish.
 */
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

/** Moves a trashed item back. Needs the delete capability. */
export async function restoreTrashItem(
  ctx: PlutoContentContext,
  id: string | number
): Promise<PlutoContentItem> {
  await authorizeContentOperation(ctx.event, ctx.type.capabilities?.delete)
  return requireTrash(ctx).restore(ctx, id)
}

/** Deletes a trashed item forever. Needs the delete capability. */
export async function purgeTrashItem(
  ctx: PlutoContentContext,
  id: string | number
): Promise<void> {
  await authorizeContentOperation(ctx.event, ctx.type.capabilities?.delete)
  await requireTrash(ctx).purge(ctx, id)
}

/** Deletes every trashed item of the type forever. Needs the delete capability. */
export async function emptyTrash(
  ctx: PlutoContentContext,
  now: Date = new Date()
): Promise<{ purged: number }> {
  await authorizeContentOperation(ctx.event, ctx.type.capabilities?.delete)
  // One second ahead, so an item trashed in this second goes too.
  const purged = await requireTrash(ctx).purgeBefore(
    ctx,
    new Date(now.getTime() + 1000).toISOString()
  )
  return { purged }
}

/** Most weeks the activity route accepts. */
export const CONTENT_ACTIVITY_MAX_WEEKS = 52

/** Monday 00:00 UTC of the week that contains `date`. */
function startOfWeekUtc(date: Date): Date {
  const start = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  )
  const daysSinceMonday = (start.getUTCDay() + 6) % 7
  start.setUTCDate(start.getUTCDate() - daysSinceMonday)
  return start
}

/**
 * Counts the items created in each of the last `weeks` weeks, oldest first.
 * The last point is the current week, so far. Weeks start on Monday, UTC.
 *
 * No capability check, for the same reason as `listContentItems`: it only
 * returns counts, and the adapter's backing store already limits what the
 * caller can see.
 *
 * Returns `supported: false` with no points when the adapter has no
 * `countCreated`, or when it returns `null` for this content type.
 */
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

/** Most revisions in one page. */
export const CONTENT_REVISIONS_MAX_LIMIT = 50

/** The history of an item is for its editors: the type write capability. */
async function authorizeRevisions(ctx: PlutoContentContext): Promise<void> {
  await authorizeContentOperation(ctx.event, ctx.type.capabilities?.write)
}

/**
 * The saved versions of one item, newest first. It needs the write capability of the type: only
 * an editor can restore one. Returns `supported: false` when the adapter keeps no revisions.
 */
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

/** One item as it was at a revision. The same rule as `listContentRevisions`. 404 when it has none. */
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

// --- Server copy of the unsaved changes ------------------------------------------------

/** The server copy is for the editors of the type: the write capability, as a save. */
async function authorizeBackup(ctx: PlutoContentContext): Promise<void> {
  await authorizeContentOperation(ctx.event, ctx.type.capabilities?.write)
}

/** The key of the copy: the item id, or '+new' when the request has none. */
function backupKeyOf(id: string | undefined): string {
  return id || NEW_BACKUP_KEY
}

/**
 * The server copy of the caller for one item (`id` absent: a new item). Returns
 * `supported: false` before any check when the adapter keeps no copies (the Git CMS), so the form
 * sends one cheap request and no backend call happens. Needs the write capability of the type.
 */
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

/**
 * Replaces the server copy of the caller. `body` is the raw request text. It must be at most
 * `PLUTO_BACKUP_MAX_CHARS` characters (413) and a record of the backup shape (400). Only the
 * declared backup fields are kept. Same rules as `getContentBackup`.
 */
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

/** Removes the server copy of the caller. Same rules as `getContentBackup`. */
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

import type { H3Event } from 'h3'
import { createError } from 'h3'
import { validateContentPayload } from '../../shared/utils/content-validate'
import { getContentAdapter, getContentType } from './pluto-content'

/**
 * The real logic behind the generic content routes, kept in plain exported
 * functions — not inline in a `server/api/**` route file — so it can be
 * unit-tested by calling it directly, the same way this workspace already
 * tests everything else: no live Nitro server, no `@nuxt/test-utils`.
 */

export function requireContentType(name: string): PlutoContentType {
  const type = getContentType(name)

  if (!type) {
    throw createError({ statusCode: 404, statusMessage: `Content type "${name}" not found.` })
  }

  return type
}

export function requireContentAdapter(): PlutoContentAdapter {
  const adapter = getContentAdapter()

  if (!adapter) {
    throw createError({ statusCode: 500, statusMessage: 'No content adapter is registered.' })
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
export async function authorizeContentOperation(event: H3Event, capability: string | undefined): Promise<void> {
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
 */
export async function listContentItems(
  ctx: PlutoContentContext,
  query: {
    limit?: number
    offset?: number
    search?: string
  }
): Promise<PlutoContentListResult> {
  return requireContentAdapter().list(ctx, {
    limit: query.limit,
    offset: query.offset,
    search: query.search,
    sort: ctx.type.defaultSort,
    includeUnpublished: true,
  })
}

/** Gets one item by id or slug. No capability check — see `listContentItems`. */
export async function getContentItem(ctx: PlutoContentContext, idOrSlug: string | number): Promise<PlutoContentItem> {
  const item = await requireContentAdapter().get(ctx, idOrSlug)

  if (!item) {
    throw createError({ statusCode: 404, statusMessage: 'Not found.' })
  }

  return item
}

function requirePlainObjectBody(body: unknown): Record<string, unknown> {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw createError({ statusCode: 400, statusMessage: 'Request body must be a JSON object.' })
  }

  return body as Record<string, unknown>
}

/**
 * Creates one item. Validates the full payload (not partial), authorizes
 * against `type.capabilities.write`, then calls the adapter, then runs
 * `type.hooks.afterCreate` when one is registered. A hook error propagates
 * — it is not swallowed.
 */
export async function createContentItem(ctx: PlutoContentContext, body: unknown): Promise<PlutoContentItem> {
  const payload = requirePlainObjectBody(body)

  const errors = validateContentPayload(ctx.type, payload)
  if (errors.length > 0) {
    throw createError({ statusCode: 400, statusMessage: 'Validation failed.', data: { errors } })
  }

  await authorizeContentOperation(ctx.event, ctx.type.capabilities?.write)

  const item = await requireContentAdapter().create(ctx, payload)

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
    throw createError({ statusCode: 400, statusMessage: 'Validation failed.', data: { errors } })
  }

  await authorizeContentOperation(ctx.event, ctx.type.capabilities?.write)

  const item = await requireContentAdapter().update(ctx, id, payload)

  if (ctx.type.hooks?.afterUpdate) {
    await ctx.type.hooks.afterUpdate(ctx, item, payload)
  }

  return item
}

/** Deletes one item. Authorizes against `type.capabilities.delete` before calling the adapter. */
export async function deleteContentItem(ctx: PlutoContentContext, id: string | number): Promise<void> {
  await authorizeContentOperation(ctx.event, ctx.type.capabilities?.delete)

  await requireContentAdapter().remove(ctx, id)
}

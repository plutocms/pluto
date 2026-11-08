// Pure part of `PlutoContentForm`. It does not use Nuxt auto-imports, so
// plain Vitest can import it.
import type {
  PlutoContentItem,
  PlutoContentType,
} from '../../../shared/types/content'

/**
 * Builds the body the form sends on save.
 *
 * - It copies each declared field that the item has. It drops all other keys.
 * - It sets `status` when `statusOverride` is given.
 * - It copies the reserved `_version` token when the item has one. See
 *   `PlutoContentItem`.
 */
export function buildContentPayload(
  type: PlutoContentType | undefined,
  item: Partial<PlutoContentItem>,
  statusOverride?: string,
  /** The planned time (ISO) of a scheduled save. See `status.schedule`. */
  publishAt?: string
): Record<string, unknown> {
  if (!type) {
    return {}
  }

  const payload: Record<string, unknown> = {}
  // `Object.keys` is tracked by a Vue reactive object, `Object.hasOwn` is not. A computed that
  // calls this function must see a key that the item gets later (a new item starts empty).
  const keys = new Set(Object.keys(item))
  for (const field of type.fields) {
    if (keys.has(field.name)) {
      payload[field.name] = item[field.name]
    }
  }

  if (item._version !== undefined) {
    payload._version = item._version
  }

  if (statusOverride !== undefined) {
    payload.status = statusOverride
  }
  if (publishAt !== undefined) {
    payload.publishAt = publishAt
  }

  return payload
}

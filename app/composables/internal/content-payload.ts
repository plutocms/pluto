// Pure part of `PlutoContentForm`. It does not use Nuxt auto-imports, so
// plain Vitest can import it.
import type { PlutoContentItem, PlutoContentType } from '../../../shared/types/content'

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
  statusOverride?: string
): Record<string, unknown> {
  if (!type) {
    return {}
  }

  const payload: Record<string, unknown> = {}
  for (const field of type.fields) {
    if (Object.hasOwn(item, field.name)) {
      payload[field.name] = item[field.name]
    }
  }

  if (item._version !== undefined) {
    payload._version = item._version
  }

  if (statusOverride !== undefined) {
    payload.status = statusOverride
  }

  return payload
}

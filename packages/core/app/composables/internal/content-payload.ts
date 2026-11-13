import type {
  PlutoContentItem,
  PlutoContentType,
} from '../../../shared/types/content'

export function buildContentPayload(
  type: PlutoContentType | undefined,
  item: Partial<PlutoContentItem>,
  statusOverride?: string,
  publishAt?: string
): Record<string, unknown> {
  if (!type) {
    return {}
  }

  const payload: Record<string, unknown> = {}
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

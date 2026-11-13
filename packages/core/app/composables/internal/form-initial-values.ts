// No Nuxt auto-imports here: plain Vitest imports this file.
import type {
  PlutoContentType,
  PlutoReferenceField,
} from '../../../shared/types/content'

export function rememberFields(
  type: PlutoContentType | undefined
): Array<PlutoReferenceField & { target: string }> {
  return (type?.fields ?? []).filter(
    (field): field is PlutoReferenceField & { target: string } =>
      field.type === 'reference' &&
      field.remember === true &&
      typeof field.target === 'string' &&
      field.target !== ''
  )
}

export function rememberKey(input: {
  base: string
  userId: string
  type: string
  field: string
}): string {
  return `pluto:remember:${JSON.stringify([input.base, input.userId, input.type, input.field])}`
}

function isEmpty(value: unknown): boolean {
  return (
    value === undefined ||
    value === null ||
    value === '' ||
    (Array.isArray(value) && value.length === 0)
  )
}

function copy(value: unknown): unknown {
  return value !== null && typeof value === 'object'
    ? JSON.parse(JSON.stringify(value))
    : value
}

export function initialValues(
  type: PlutoContentType | undefined,
  remembered: Record<string, unknown> = {}
): Record<string, unknown> {
  const values: Record<string, unknown> = {}
  for (const field of type?.fields ?? []) {
    if (field.default !== undefined) {
      values[field.name] = copy(field.default)
    }
  }
  for (const field of rememberFields(type)) {
    const value = remembered[field.name]
    if (!isEmpty(value)) {
      values[field.name] = copy(value)
    }
  }
  return values
}

export function readRemembered(
  storage: Pick<Storage, 'getItem'>,
  key: string
): unknown {
  try {
    const text = storage.getItem(key)
    return text === null ? undefined : JSON.parse(text)
  } catch {
    return undefined
  }
}

export function writeRemembered(
  storage: Pick<Storage, 'setItem' | 'removeItem'>,
  key: string,
  value: unknown
): void {
  try {
    if (isEmpty(value)) {
      storage.removeItem(key)
    } else {
      storage.setItem(key, JSON.stringify(value))
    }
  } catch {
    // A full or blocked storage: the next new item is not filled.
  }
}

export function keepKnownIds(
  field: Pick<PlutoReferenceField, 'multiple'>,
  value: unknown,
  known: ReadonlySet<string>
): unknown {
  if (field.multiple) {
    return Array.isArray(value)
      ? value.filter((id) => known.has(String(id)))
      : []
  }
  return value !== undefined && value !== null && known.has(String(value))
    ? value
    : undefined
}

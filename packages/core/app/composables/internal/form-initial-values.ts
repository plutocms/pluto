import type {
  PlutoContentType,
  PlutoReferenceField,
} from '../../../shared/types/content'

// The first values of a new item in `PlutoContentForm`: the `default` of each field, then the
// value that the user saved last time in each `remember` field. Pure, with no Nuxt imports, so
// plain Vitest can test it. See the authors skill.

/** The `remember` reference fields of a type. They need a `target`. */
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

/** The storage key of a remembered value: one per site, user, type and field. */
export function rememberKey(input: {
  base: string
  userId: string
  type: string
  field: string
}): string {
  return `pluto:remember:${JSON.stringify([input.base, input.userId, input.type, input.field])}`
}

/** True for a value that holds nothing: `undefined`, `null`, `''` or `[]`. */
function isEmpty(value: unknown): boolean {
  return (
    value === undefined ||
    value === null ||
    value === '' ||
    (Array.isArray(value) && value.length === 0)
  )
}

/** A copy of a plain value, so the form never changes the `default` of the type. */
function copy(value: unknown): unknown {
  return value !== null && typeof value === 'object'
    ? JSON.parse(JSON.stringify(value))
    : value
}

/**
 * The first values of a new item: the `default` of each field that has one, then the remembered
 * value of each `remember` field (it replaces the default). A field with no value is left out.
 */
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

/** The remembered value under `key`, or `undefined`. A broken value counts as none. */
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

/** Keeps `value` under `key`. An empty value removes the key. A storage error is ignored. */
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

/**
 * The value without the ids that are not in `known` (a deleted item): a list for a `multiple`
 * field, else the id or `undefined`.
 */
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

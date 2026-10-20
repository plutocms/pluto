/**
 * One item in the public list. It has no body. `excerpt` is the excerpt field
 * of the type, or a plain-text start of the body when that field is empty.
 * The other keys are the fields of the content type.
 */
export type PlutoCmsListItem = Record<string, unknown> & {
  /** The slug. */
  id: string
  excerpt: string
  _version?: string
}

/** The answer of the public list route. */
export interface PlutoCmsListResult {
  data: PlutoCmsListItem[]
  /** The number of published items, before `limit` and `offset`. */
  total: number
  limit: number
  offset: number
}

/** One published item. `html` is the body as sanitized HTML. */
export type PlutoCmsItem = Record<string, unknown> & {
  /** The slug. */
  id: string
  /** The body as sanitized HTML. Safe for `PlutoMarkdown`. */
  html: string
  _version?: string
}

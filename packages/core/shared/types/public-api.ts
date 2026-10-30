/**
 * The answers of the public API (`/api/pluto/v1/...`). See the content-model skill and the
 * "Public API" page of the docs.
 */

/** One item of a public answer: `id`, the public fields of the type, and the timestamps it has. */
export type PlutoPublicItem = Record<string, unknown> & {
  id: string | number
  createdAt?: string
  updatedAt?: string
  publishedAt?: string
}

/** The answer of a list route. */
export interface PlutoPublicList<T = PlutoPublicItem> {
  data: T[]
  meta: {
    /** The number of matching items, before `limit` and `offset`. */
    total: number
    limit: number
    offset: number
  }
}

/** The answer of a route for one thing. */
export interface PlutoPublicOne<T = PlutoPublicItem> {
  data: T
}

/** The query of a list route. */
export interface PlutoPublicQuery {
  /** 1 to 100. Default 20. */
  limit?: number
  offset?: number
  /** Searches the title field. */
  search?: string
  /** A public field or `createdAt`, `updatedAt`, `publishedAt`. A leading `-` sorts descending. */
  sort?: string
  /** Equality filters on public fields. */
  filter?: Record<string, string | number | boolean>
}

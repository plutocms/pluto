import type { MaybeRefOrGetter } from 'vue'
import type { PlutoPublicMedia } from './media'

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

/** A post in a list of the public API (`usePosts`): both backends give these keys. */
export interface PlutoPostSummary {
  id: string | number
  slug: string
  title: string
  excerpt?: string | null
  cover?: PlutoPublicMedia | null
  createdAt?: string
  updatedAt?: string
  publishedAt?: string
}

/** One post of the public API (`usePost`), with its body as sanitized HTML. */
export interface PlutoPost extends PlutoPostSummary {
  html: string
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

/** The options of a list composable (`usePosts`, or `useList` of `definePlutoContent`). */
export interface PlutoContentListOptions {
  /** Items per page, 1 to 100. Default 20. */
  limit?: number
  /** Searches the title field. An empty value lists everything. */
  search?: MaybeRefOrGetter<string | null | undefined>
  /** A public field or `createdAt`, `updatedAt`, `publishedAt`. A leading `-` sorts descending. */
  sort?: MaybeRefOrGetter<string | undefined>
  /** Equality filters on public fields. */
  filter?: MaybeRefOrGetter<PlutoPublicQuery['filter']>
  /**
   * The page, from 1. Default: `?page=` of the URL, and setting `page` changes the URL (page 1
   * has no `page` key). A number or a ref: that page. `false`: the first page only.
   */
  page?: MaybeRefOrGetter<number> | false
}

/** The options of an item composable (`usePost`, or `useItem` of `definePlutoContent`). */
export interface PlutoContentItemOptions {
  /**
   * `'throw'` (default): a missing item, or a draft, shows the error page with a 404 (another
   * failure shows it with its own status). `'null'`: the item is `null` and `error` is set.
   */
  notFound?: 'throw' | 'null'
  /**
   * Sets the SEO tags of the page from the item: the title (the title field), the description
   * (`excerpt` or `description`) and `og:image` (the first image field). Default true.
   */
  seo?: boolean
  /** Shows "Edit <type>" in the admin bar for the item. Default true. */
  editLink?: boolean
}

/** The options of `definePlutoContent`. */
export interface PlutoContentDefaults {
  /** The defaults of `useList`, for example the sort. */
  list?: PlutoContentListOptions
  /** `og:type` of an item page. Default `website`. */
  ogType?: 'website' | 'article'
}

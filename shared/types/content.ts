import type { H3Event } from 'h3'

export type PlutoFieldType =
  | 'text'
  | 'textarea'
  | 'richtext'
  | 'slug'
  | 'number'
  | 'boolean'
  | 'date'
  | 'select'
  | 'reference'
  | 'media'

/**
 * Fields every `PlutoField` shares, regardless of `type`. A concrete field
 * (`PlutoTextField`, `PlutoSlugField`, and so on) narrows `type` to one
 * literal and adds its own type-specific options on top of this base.
 */
export interface PlutoFieldBase {
  /** Field key. Used as the object key on a `PlutoContentItem`, and as the default storage column (see `fieldColumn` in `shared/utils/content-map.ts`). */
  name: string
  type: PlutoFieldType
  label: string
  description?: string
  /** Storage column, when it differs from `name`. Falls back to `name` when unset. */
  column?: string
  required?: boolean
  /** Show this field as a column in the generic list view. Default false. */
  inList?: boolean
  /** Show this field in the generic form view. Default true. */
  inForm?: boolean
  /** Lower comes first, in both the list and the form. Default 100. */
  order?: number
  default?: unknown
  /** Name of a registered `PlutoContentFieldWidget` to force, overriding the default resolved by `type`. */
  widget?: string
  /** Which column of the generic form this field renders in. Default 'main'. */
  region?: 'main' | 'side'
}

export interface PlutoTextField extends PlutoFieldBase {
  type: 'text' | 'textarea' | 'richtext'
  maxLength?: number
  placeholder?: string
}

export interface PlutoSlugField extends PlutoFieldBase {
  type: 'slug'
  /** Name of the field this slug is generated from, for example 'title'. */
  from?: string
  preview?: string
}

export interface PlutoNumberField extends PlutoFieldBase {
  type: 'number'
  integer?: boolean
  min?: number
  max?: number
}

export interface PlutoSelectField extends PlutoFieldBase {
  type: 'select'
  options: Array<{
    label: string
    value: string | number
  }>
}

export interface PlutoReferenceField extends PlutoFieldBase {
  type: 'reference'
  /** Name of the referenced content type, for example 'category'. */
  target?: string
  optionsUrl?: string
  labelKey?: string
  valueKey?: string
}

export interface PlutoMediaField extends PlutoFieldBase {
  type: 'media'
  multiple?: boolean
}

export interface PlutoBooleanField extends PlutoFieldBase {
  type: 'boolean'
}

export interface PlutoDateField extends PlutoFieldBase {
  type: 'date'
}

export type PlutoField =
  | PlutoTextField
  | PlutoSlugField
  | PlutoNumberField
  | PlutoSelectField
  | PlutoReferenceField
  | PlutoMediaField
  | PlutoBooleanField
  | PlutoDateField

/**
 * Capability keys a content-type adapter checks before it reads, writes, or
 * deletes a row. Plain strings, not registered `PlutoCapability` entries —
 * see the permissions skill for the format (`<namespace>:<action>`).
 */
export interface PlutoContentTypeCapabilities {
  read?: string
  write?: string
  delete?: string
}

export interface PlutoContentStatus {
  /** Storage column. Falls back to 'status' when unset. */
  column?: string
  values: Array<{
    label: string
    value: string
  }>
  default?: string
  /** The `values[].value` that counts as published, for example 'published'. */
  publishedValue?: string
  publishedAtColumn?: string
}

export interface PlutoContentTimestamps {
  /** Storage column, or `false` to disable this timestamp. Falls back to 'created_at' when unset. */
  created?: string | false
  /** Storage column, or `false` to disable this timestamp. Falls back to 'updated_at' when unset. */
  updated?: string | false
}

export interface PlutoContentI18n {
  /** Reserved for a future release. Only 'row' will ever be supported: one row per locale. Not implemented yet — declaring it costs nothing and avoids a breaking rename later. */
  strategy: 'row'
  localeColumn?: string
  groupColumn?: string
}

/**
 * The contract for one content type: what fields it has, where it is
 * stored, and how the generic list/form UI (a later wave) should render it.
 * A layer declares one of these per content type it owns, through
 * `defineContentType`.
 */
export interface PlutoContentType {
  /**
   * The content type's own identifier, for example 'post'. Kept separate
   * from a registered `PlutoContentTypeEntry.id` for the exact same reason
   * `PlutoCapability.key` is kept separate from `id` (see
   * `shared/types/registry.ts`): the registry rewrites `id` to
   * `'<extensionId>:<id>'`, which would corrupt a name used in a URL path
   * segment or as a lookup key. Always read `name` for the real content
   * type identity, never the registry entry's `id`.
   */
  name: string
  label: string
  labelPlural: string
  icon?: string
  /** Table or view name this content type reads and writes. */
  source: string
  /** Storage column for the primary key. Falls back to 'id' when unset. */
  primaryKey?: string
  /** Name of the field shown as the row's title in lists and breadcrumbs. */
  titleField: string
  fields: PlutoField[]
  /** Name of the field that holds the slug, or `false` to disable slugging entirely. */
  slug?: {
    field: string
  } | false
  /** `false` disables status/publish workflow entirely for this content type. */
  status?: PlutoContentStatus | false
  /** `false` disables created/updated timestamps entirely for this content type. */
  timestamps?: PlutoContentTimestamps | false
  capabilities?: PlutoContentTypeCapabilities
  defaultSort?: {
    field: string
    direction: 'asc' | 'desc'
  }
  /** Whether a later wave should generate list/edit/create admin routes for this content type. */
  autoRoutes?: boolean
  /** Base admin path for generated routes, for example '/admin/posts'. Only meaningful when `autoRoutes` is true. */
  basePath?: string
  navOrder?: number
  i18n?: PlutoContentI18n
  /**
   * Server-only lifecycle hooks, run by the generic write handlers
   * (`server/utils/pluto-content-handlers.ts`) after the adapter call
   * succeeds and before the response goes out. Lets a layer with extra
   * logic around a write — for example `supabase-shop` reconciling
   * `product_media` rows after a product write — hook in without a bespoke
   * endpoint just for that, and without polluting the generic adapter
   * contract with a per-layer concern.
   */
  hooks?: {
    afterCreate?: (ctx: PlutoContentContext, item: PlutoContentItem, rawBody: Record<string, unknown>) => Promise<void> | void
    afterUpdate?: (ctx: PlutoContentContext, item: PlutoContentItem, rawBody: Record<string, unknown>) => Promise<void> | void
  }
}

/**
 * One stored content row, keyed by field name (not column name — see
 * `mapColumnsToFields` in `shared/utils/content-map.ts` for the
 * column-to-field translation). Named `PlutoContentItem`, not
 * `PlutoEntryRecord`, to avoid visual confusion with `PlutoEntry` (a
 * registry bucket item, see `shared/types/registry.ts`) — this type has
 * nothing to do with the registry.
 */
export type PlutoContentItem = Record<string, unknown> & {
  id: string | number
}

/** Options for a generic list read. See `server/utils/pluto-content-handlers.ts`. */
export interface PlutoContentQuery {
  limit?: number
  offset?: number
  search?: string
  sort?: {
    field: string
    direction: 'asc' | 'desc'
  }
  includeUnpublished?: boolean
}

export interface PlutoContentListResult {
  data: PlutoContentItem[]
  total?: number
}

/** Per-request context an adapter method receives: the H3 event, and the content type being read or written. */
export interface PlutoContentContext {
  event: H3Event
  type: PlutoContentType
}

/**
 * Lets a backend layer (`@plutocms/supabase`, and so on) plug its own
 * storage into the generic content server routes, without core knowing
 * which backend is in use — the same role `PlutoMediaAdapter` plays for
 * media. Exactly one adapter is meaningful per app, registered through
 * `registerContentAdapter` (see `server/utils/pluto-content.ts`).
 */
export interface PlutoContentAdapter {
  id: string
  list: (ctx: PlutoContentContext, query: PlutoContentQuery) => Promise<PlutoContentListResult>
  get: (ctx: PlutoContentContext, idOrSlug: string | number) => Promise<PlutoContentItem | null>
  create: (ctx: PlutoContentContext, values: Record<string, unknown>) => Promise<PlutoContentItem>
  update: (ctx: PlutoContentContext, id: string | number, values: Record<string, unknown>) => Promise<PlutoContentItem>
  remove: (ctx: PlutoContentContext, id: string | number) => Promise<void>
  /** Throws when `event`'s caller does not hold `capability`. Optional — see the fail-open rule in the content-model skill. */
  authorize?: (event: H3Event, capability: string) => Promise<void>
  describe?: (ctx: PlutoContentContext) => Promise<string[] | null>
}

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
  /** This field has no storage column. Its value never reaches `mapFieldsToColumns`'s output, but still passes through validation and the generic form payload — letting a `hooks.afterCreate`/`afterUpdate` read it from `rawBody` without a matching database column. */
  virtual?: boolean
  required?: boolean
  /** Show this field as a column in the generic list view. Default false. */
  inList?: boolean
  /**
   * Formats this field's value for the generic list, in the desktop table and the mobile cards. Return the text to show. For example, a price in cents can show as "R$ 49,90". Only the list uses it. The form and the API keep the raw value. It must be a pure function with no browser dependency, because content type definitions are shared with the server. If it throws, the list shows the raw value.
   */
  listFormat?: (value: unknown, item: PlutoContentItem) => string
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
  /** Only for `textarea`. The minimum height in rows. Default 4. */
  rows?: number
  /** Only for `textarea`. The box grows with the text up to this many rows, then it scrolls. Default 14. */
  maxRows?: number
  /**
   * Only for `richtext` in the GitHub CMS (the Markdown widget). `'visual'` opens the rich editor. `'source'` opens the
   * raw Markdown text. `'auto'` (default) opens the source when the text has syntax that the rich editor
   * cannot keep (MDC, HTML, tables, task lists, footnotes). The widget has a Visual/Source switch, and it
   * disables Visual while the text has such syntax.
   */
  editor?: 'auto' | 'visual' | 'source'
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

/**
 * Files of the media library. The value is one media id, or a list of ids in
 * order (`multiple`). The public API gives the records in place of the ids.
 * See the media skill.
 */
export interface PlutoMediaField extends PlutoFieldBase {
  type: 'media'
  multiple?: boolean
  /** The file types the picker shows and the upload takes: `['image/*']`, `['model/gltf-binary']`. All types when unset. */
  accept?: string[]
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
  /** Capability required to publish. Falls back to `write` when unset. */
  publish?: string
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
  slug?:
    | {
        field: string
      }
    | false
  /** `false` disables status/publish workflow entirely for this content type. */
  status?: PlutoContentStatus | false
  /** `false` disables created/updated timestamps entirely for this content type. */
  timestamps?: PlutoContentTimestamps | false
  capabilities?: PlutoContentTypeCapabilities
  defaultSort?: {
    field: string
    direction: 'asc' | 'desc'
  }
  /** Whether nav/pages entries should be derived automatically for this content type. `false` when a layer keeps its own hand-declared `nav`/`pages` at its own URLs. */
  autoRoutes?: boolean
  /**
   * Base admin path `PlutoContentList`/`PlutoContentForm` build their own
   * links from, for example '/admin/posts'. Used regardless of
   * `autoRoutes` — it is not only for auto-derived nav/pages, it is also
   * what the generic components' own "add new" button, row edit links,
   * and post-create redirect are built from. Defaults to
   * `/admin/content/<name>` when unset.
   */
  basePath?: string
  /**
   * Overrides the "create new" link the generic list page links to.
   * Defaults to `${basePath}/new`. Set this when an existing layer's
   * create URL does not follow that convention (for example
   * `/admin/post/new`, singular, alongside a plural `basePath`) — this
   * field exists specifically so an already-deployed URL never has to
   * change to adopt the content model.
   */
  newPath?: string
  /**
   * Overrides the edit link (and the post-create redirect target) for a
   * given id. Defaults to `${basePath}/${id}`. Set this when an existing
   * layer's edit URL does not follow that convention (for example
   * `/admin/post/edit/:id`, with an extra literal segment `basePath`
   * alone cannot express) — the same reasoning as `newPath`.
   */
  editPath?: (id: string | number) => string
  /**
   * Buttons of this type in the admin bar, for a user with the `write`
   * capability. `new`: "New <type>" on every page. `edit`: "Edit <type>" on a
   * public page that calls `usePlutoEditLink(type, id)`. `true` gives both.
   * Unset gives none. See the admin-shell skill.
   */
  adminBar?:
    | boolean
    | {
        new?: boolean
        edit?: boolean
      }
  navOrder?: number
  i18n?: PlutoContentI18n
  /**
   * The public URL of an item, for the "View <label>" link in the form toolbar. Return
   * `undefined` when the item has no public page (a draft, or a new item). The
   * link shows in edit mode only. The function must be pure and must not read
   * browser globals, because content type definitions are shared with the server.
   */
  previewUrl?: (item: PlutoContentItem) => string | undefined
  /**
   * The public site shows a save at once, because it reads this type at run time. A deploy may
   * still run. The build indicator of the edit form (GitHub CMS) then shows "Live" right after a
   * save, and shows the static build by a small spinner on the Info button. Default false: the
   * indicator waits for the build and shows "Publishing…".
   */
  liveOnSave?: boolean
  /** The public API of this type (`/api/pluto/v1/content/<name>`). See `PlutoContentApi`. */
  api?: PlutoContentApi
  /** Layout options for the generic content form. */
  form?: {
    /**
     * 'default' = fields in a container, aside on the right. 'focus' = minimal chrome
     * for a writing surface. 'canvas' = a full-height field (see `canvasField`) between a
     * left panel and a right panel. Every layout has the same toolbar: the item title,
     * the save state and the save buttons.
     */
    layout?: 'default' | 'focus' | 'canvas'
    /** The field that fills the main region in the 'canvas' layout. Required for 'canvas'. */
    canvasField?: string
    /**
     * 'canvas' only: the widget of the canvas field adds a left panel. Core shows a skeleton
     * of a list panel there while the item or the widget code loads, so the panel does not pop
     * in later. A string is the label (key-or-literal). An object also gives `class`, the
     * classes of the skeleton root (for example the background of the real panel).
     */
    leftPanel?:
      | string
      | {
          label: string
          class?: string
        }
    /** true = always show. false = never. 'auto' (default) = show when any field has region 'side'. */
    aside?: boolean | 'auto'
    /** Aside starts closed. Default false, or true when layout is 'focus'. */
    asideCollapsed?: boolean
    /** Drop the max-width container in the main region. Default false, or true when layout is 'focus'. */
    width?: 'container' | 'full'
  }
  /**
   * Options for the file adapters (the GitHub CMS). Other adapters ignore them. Every member is
   * plain data or a pure function, so the definition is safe on the server and on the client.
   */
  files?: PlutoContentFiles
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
    afterCreate?: (
      ctx: PlutoContentContext,
      item: PlutoContentItem,
      rawBody: Record<string, unknown>
    ) => Promise<void> | void
    afterUpdate?: (
      ctx: PlutoContentContext,
      item: PlutoContentItem,
      rawBody: Record<string, unknown>
    ) => Promise<void> | void
    /**
     * Changes the answer of the public API for one item, after the allow-list and after
     * `adapter.toPublic`. Return the object to send, for example with a relation or an image URL
     * added. Runs on the server only, so set it where the layer registers the type on the server.
     */
    toPublic?: PlutoContentToPublic
  }
}

/**
 * The public API of a content type. The routes are `GET /api/pluto/v1/content/<name>` (the list)
 * and `GET /api/pluto/v1/content/<name>/<id or slug>` (one item). They are anonymous and return
 * published items only. See the content-model skill.
 */
export interface PlutoContentApi {
  /** Serve this type on the public API. Default false: a type is private until it opts in. */
  public?: boolean
  /**
   * The fields that the public API returns, by field name. Default: every field that is not
   * `virtual`. `id` and the timestamps (`createdAt`, `updatedAt`, `publishedAt`) are always in.
   * Only these fields can be used in `sort` and `filter`.
   */
  fields?: string[]
}

/** The view of the public API that an answer is for. */
export type PlutoPublicView = 'list' | 'item'

/** `adapter.toPublic` and `hooks.toPublic`: change the public answer of one item. */
export type PlutoContentToPublic = (
  ctx: PlutoContentContext,
  data: Record<string, unknown>,
  info: {
    view: PlutoPublicView
    /** The whole item from the adapter, also the fields that the allow-list dropped. */
    item: PlutoContentItem
    /**
     * Every item of this answer (one item for the `item` view). A hook that adds related rows
     * loads them for the whole batch once, and keeps them on `ctx.event.context` for the other
     * items, so a list of 20 items does not make 20 queries.
     */
    batch: PlutoContentItem[]
  }
) => Promise<Record<string, unknown>> | Record<string, unknown>

/** How a file adapter stores one content type. See `PlutoContentType.files`. */
export interface PlutoContentFiles {
  /**
   * Store the items in nested folders. The id is the path under the type dir, without `.md`
   * (for example `1.start/2.install`). Each segment is a lowercase slug with an optional numeric
   * prefix (`2.install`). A path has at most 6 segments. With `nested`, `source` can be `''`: the
   * type then uses the content dir itself. Default false (flat: `<source>/<slug>.md`).
   */
  nested?: boolean
  /**
   * Items that the type must not list or edit. Only for nested types. Each entry is an id
   * (`index`), or a folder with a trailing slash (`drafts/`) that covers every id under it.
   */
  exclude?: string[]
  /**
   * Maps the frontmatter between the file and the fields. Both functions must be pure. They get a
   * copy: return the object to use. A field that a hook maps uses a flat key as its `column`.
   */
  frontmatter?: {
    /** Runs after a file is parsed. Add the flat keys that the fields read, for example `navigationTitle` from `navigation.title`. */
    read?: (frontmatter: Record<string, unknown>) => Record<string, unknown>
    /** Runs before a file is written. Fold the flat keys back, and drop them. Unknown keys must stay. */
    write?: (frontmatter: Record<string, unknown>) => Record<string, unknown>
  }
}

/**
 * One stored content row, keyed by field name (not column name — see
 * `mapColumnsToFields` in `shared/utils/content-map.ts` for the
 * column-to-field translation). Named `PlutoContentItem`, not
 * `PlutoEntryRecord`, to avoid visual confusion with `PlutoEntry` (a
 * registry bucket item, see `shared/types/registry.ts`) — this type has
 * nothing to do with the registry.
 *
 * `_version` is a reserved optional key, an optimistic-concurrency token. An
 * adapter MAY return it on `get` and `list` items. The client sends it back
 * unchanged on update. An adapter that uses it answers 409 when the token no
 * longer matches the stored item. An adapter that does not use it ignores the
 * key. A content type must not declare a field named `_version`.
 *
 * `_frontmatter` is a reserved optional key too. The file adapter returns it on `get` only: the
 * whole frontmatter of the file, also the keys that no field maps. The client never sends it back.
 * A content type must not declare a field named `_frontmatter`.
 */
export type PlutoContentItem = Record<string, unknown> & {
  id: string | number
  _version?: string
  _frontmatter?: Record<string, unknown>
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
  /**
   * Equality filters, by field name. An item matches when every field equals its value. The
   * public API sends the values as text, so an adapter compares a stored number or boolean by its
   * text too (`3` matches `'3'`, `true` matches `'true'`).
   */
  filters?: Record<string, string>
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
 * which backend is in use — the same role `PlutoMediaDriver` plays for
 * media. Exactly one adapter is meaningful per app, registered through
 * `registerContentAdapter` (see `server/utils/pluto-content.ts`).
 */
export interface PlutoContentAdapter {
  id: string
  list: (
    ctx: PlutoContentContext,
    query: PlutoContentQuery
  ) => Promise<PlutoContentListResult>
  get: (
    ctx: PlutoContentContext,
    idOrSlug: string | number
  ) => Promise<PlutoContentItem | null>
  create: (
    ctx: PlutoContentContext,
    values: Record<string, unknown>
  ) => Promise<PlutoContentItem>
  update: (
    ctx: PlutoContentContext,
    id: string | number,
    values: Record<string, unknown>
  ) => Promise<PlutoContentItem>
  remove: (ctx: PlutoContentContext, id: string | number) => Promise<void>
  /** Throws when `event`'s caller does not hold `capability`. Optional — see the fail-open rule in the content-model skill. */
  authorize?: (event: H3Event, capability: string) => Promise<void>
  describe?: (ctx: PlutoContentContext) => Promise<string[] | null>
  /**
   * Counts the items created from `range.from` (inclusive) to `range.to`
   * (exclusive), both ISO timestamps. Optional. Return `null` when the
   * content type has no created timestamp. The dashboard activity chart
   * calls it once per week; without it, the chart leaves the type out.
   */
  countCreated?: (
    ctx: PlutoContentContext,
    range: {
      from: string
      to: string
    }
  ) => Promise<number | null>
  /**
   * Reads one raw file of the type, by a path relative to the type folder (for example
   * `1.start/.navigation.yml`). Optional: only a file adapter has files. Returns `null` when the
   * file does not exist, when it is not visible to the caller (a draft Markdown file for an
   * anonymous caller), and when the path is not safe: `..`, an absolute path, a backslash, or a
   * path that leaves the type folder. `version` is the same version as `_version` of an item.
   */
  readFile?: (
    ctx: PlutoContentContext,
    relativePath: string
  ) => Promise<{
    text: string
    version?: string
  } | null>
  /**
   * The keys of the timestamps on an item of `type`, when the item has them. Optional. The public
   * API reads them and answers `createdAt`, `updatedAt` and `publishedAt`. Without it, the public
   * answer has no timestamps.
   */
  timestampKeys?: (type: PlutoContentType) => {
    created?: string
    updated?: string
    published?: string
  }
  /**
   * Changes the public answer of one item, before `type.hooks.toPublic`. Optional. For example,
   * the file adapter of the CMS renders the Markdown body as HTML.
   */
  toPublic?: PlutoContentToPublic
}

/** One week of the content activity series. */
export interface PlutoContentActivityPoint {
  /** Start of the week, an ISO date (YYYY-MM-DD), Monday, UTC. */
  start: string
  count: number
}

export interface PlutoContentActivity {
  /** `false` when the adapter, or this content type, cannot count by creation date. */
  supported: boolean
  interval: 'week'
  points: PlutoContentActivityPoint[]
}

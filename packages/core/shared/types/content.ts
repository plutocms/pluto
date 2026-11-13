import type { H3Event } from 'h3'
import type { PlutoContentBackup } from '../utils/content-backup'

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
 * Options that every field shares. A concrete field (`PlutoTextField`, `PlutoSlugField`, and so
 * on) sets `type` to one literal and adds its own options.
 * @see https://pluto.vulmix.dev/docs/reference/content-model#field-types
 */
export interface PlutoFieldBase {
  /** Field key. It is the key on a `PlutoContentItem` and the default storage column. */
  name: string
  type: PlutoFieldType
  label: string
  description?: string
  /** Storage column, when it differs from `name`. Default: `name`. */
  column?: string
  /** The field has no storage column. It passes validation and reaches `hooks.afterCreate` and `hooks.afterUpdate` in `rawBody`, but the adapter does not store it. */
  virtual?: boolean
  required?: boolean
  /** Show this field as a column in the generic list view. Default false. */
  inList?: boolean
  /**
   * Offer this field as a filter of the admin list. Only a `select`, a `boolean` and a `reference`
   * with a `target` can filter. A reference with a target filters by default; a select and a
   * boolean filter by default when they are `inList`. `true` turns it on, `false` turns it off.
   */
  filter?: boolean
  /**
   * Let the admin list sort by this column. An `inList` field of type `text`, `textarea`, `slug`,
   * `number`, `select`, `boolean` or `date` sorts by default. Set `false` to turn it off.
   */
  sortable?: boolean
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
  /**
   * The id of a group of `sideGroups` of the type: a field of the side column shows in that
   * collapsible group. None (or an id the type does not have): it shows above the groups.
   */
  group?: string
}

/**
 * A collapsible group of the side column of the form (`PlutoContentType.sideGroups`). A layer that
 * adds fields to a type can add its group with them.
 */
export interface PlutoContentSideGroup {
  id: string
  /** A translation key or a literal. */
  label: string
  icon?: string
  /** Lower comes first. Default 100. */
  order?: number
  /** Open when the form loads. Default `true`. */
  defaultOpen?: boolean
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
   * Only for `richtext` in the Git CMS (the Markdown widget). `'visual'` opens the rich editor. `'source'` opens the
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
  /**
   * Name of the referenced content type, for example 'category'. The value is the id of an item of
   * that type, or a list of ids (`multiple`). The public API gives `{ id, label, slug? }` in place
   * of each id when the target is public.
   * @see https://pluto.vulmix.dev/docs/reference/content-model#reference-fields
   */
  target?: string
  /** The value is a list of ids, in order. */
  multiple?: boolean
  /** The admin widget can create a new item of `target` inline. Needs `target`. */
  create?: boolean
  /**
   * More fields of the `target` item to put in each public reference, for example
   * `['avatar', 'bio']` for an author. Only the public fields of the target count (stored, and in
   * its `api.fields` when that is set). A `media` field gives its record. The values are the stored
   * values: the `toPublic` hooks of the target do not run. Needs `target`.
   */
  publicFields?: string[]
  /**
   * On a new item, the form fills this field with the value that the user saved last time for
   * this type (kept in the browser). A value with no item any more is not filled. Needs `target`.
   */
  remember?: boolean
  optionsUrl?: string
  labelKey?: string
  valueKey?: string
}

/**
 * Files of the media library. The value is one media id, or a list of ids in
 * order (`multiple`). The public API gives the records in place of the ids.
 * @see https://pluto.vulmix.dev/docs/reference/content-model#media-fields
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
 * Capability keys that the server checks before it reads, writes or deletes an item. The format is
 * `<namespace>:<action>`.
 * @see https://pluto.vulmix.dev/docs/reference/content-model#capabilities
 */
export interface PlutoContentTypeCapabilities {
  read?: string
  write?: string
  delete?: string
  /** Capability required to publish. Falls back to `write` when unset. */
  publish?: string
}

export interface PlutoContentStatus {
  /** Storage column. Default: 'status'. */
  column?: string
  values: Array<{
    label: string
    value: string
  }>
  default?: string
  /** The `values[].value` that counts as published, for example 'published'. */
  publishedValue?: string
  publishedAtColumn?: string
  /**
   * Scheduled publish. A user with the publish capability sets a time, and the item has the status
   * `value` (default `'scheduled'`) until then. The time is in `publishedAtColumn`, so the type
   * needs one (without it, the option does nothing). At the time the item is live (the public API
   * shows it), and the scheduled task `pluto:publish:scheduled` sets the status to published. The
   * adapter must have `publishDue`. Do not list the value in `values`: core adds it.
   * @see https://pluto.vulmix.dev/docs/reference/content-model#scheduled-publish-and-review
   */
  schedule?: boolean | { value?: string }
  /**
   * Pending review. A user with the write capability but not the publish capability can set the
   * status `value` (default `'review'`), and a user with publish then publishes it. Do not list
   * the value in `values`: core adds it.
   */
  review?: boolean | { value?: string }
}

export interface PlutoContentTimestamps {
  /** Storage column, or `false` to turn this timestamp off. Default: 'created_at'. */
  created?: string | false
  /** Storage column, or `false` to turn this timestamp off. Default: 'updated_at'. */
  updated?: string | false
}

/**
 * A change that a layer makes to content types it does not own, for example new fields on the
 * `post` type. `extend` is pure: it gets a type and returns a new one (the same object when it
 * changes nothing). It runs for every type, so it checks `type.name` itself. A later extension
 * with the same `id` replaces an earlier one.
 * @see https://pluto.vulmix.dev/docs/reference/content-model#extend-a-content-type-of-another-layer
 */
export interface PlutoContentTypeExtension {
  id: string
  /** Lower runs first. Default 100. */
  order?: number
  extend: (type: PlutoContentType) => PlutoContentType
}

export interface PlutoContentI18n {
  /** Reserved. Not implemented yet. */
  strategy: 'row'
  localeColumn?: string
  groupColumn?: string
}

/**
 * One content type: its fields, where it is stored, and how the generic admin list and form show
 * it. Declare it with `defineContentType`.
 * @see https://pluto.vulmix.dev/docs/reference/content-model#content-type-options
 */
export interface PlutoContentType {
  /**
   * The identifier of the type, for example 'post'. It is used in URLs and as a lookup key. Read
   * `name`, not the `id` of the registry entry: the registry rewrites that `id`.
   * @see https://pluto.vulmix.dev/docs/reference/content-model#name-and-id
   */
  name: string
  label: string
  labelPlural: string
  /**
   * One sentence about the type, for the editor: what it holds and where the site shows it. The
   * page of a singleton type shows it under its title. A translation key
   * (`content.<name>.description`) wins over it.
   */
  description?: string
  icon?: string
  /** Table or view name this content type reads and writes. */
  source: string
  /** Storage column of the primary key. Default: 'id'. */
  primaryKey?: string
  /** Name of the field shown as the row's title in lists and breadcrumbs. */
  titleField: string
  fields: PlutoField[]
  /** Name of the field that holds the slug, or `false` for a type with no slug. */
  slug?:
    | {
        field: string
      }
    | false
  /** `false` turns off the status and publish workflow for this type. */
  status?: PlutoContentStatus | false
  /**
   * Remove moves an item to the trash, and the admin has a Trash tab for the type. A trashed item
   * goes for good after 30 days, or with Delete forever. Default off: a remove is final. The
   * adapter must have `trash`. Supabase needs a `deleted_at` column on the table (`column` names
   * another one); the Git CMS keeps the file in `<dir>/.trash/<type name>/`.
   * @see https://pluto.vulmix.dev/docs/reference/content-model#trash
   */
  trash?: boolean | { column?: string }
  /**
   * A short summary of the item. Core adds a text area named `field` (default `excerpt`) when the
   * type does not declare it. The public API gives `excerpt`: the field, else the start of the body
   * (the first `richtext` field) as plain text.
   * @see https://pluto.vulmix.dev/docs/reference/content-model#excerpt-and-cover-image
   */
  excerpt?: boolean | { field?: string }
  /**
   * The cover image of the item. Core adds a `media` field (one image) named `field` (default
   * `cover`) when the type does not declare it. The public API gives `cover` (the media record),
   * the admin list shows it, and the SEO of a site uses it for `og:image`.
   * @see https://pluto.vulmix.dev/docs/reference/content-model#excerpt-and-cover-image
   */
  cover?: boolean | { field?: string }
  /** `false` turns off the created and updated timestamps for this type. */
  timestamps?: PlutoContentTimestamps | false
  capabilities?: PlutoContentTypeCapabilities
  /** The collapsible groups of the side column of the form. A field joins one with `group`. */
  sideGroups?: PlutoContentSideGroup[]
  defaultSort?: {
    field: string
    direction: 'asc' | 'desc'
  }
  /**
   * The type has one item (site info, contact data, a home page with fixed sections). The admin
   * shows its form at `basePath`, with no list, and the site reads it with `usePlutoSingleton`.
   * `id` is the id of the item in the Git CMS (default: the type `name`), so the file is
   * `<dir>/<source>/<id>.md`. On Supabase the `source` table holds one row.
   * @see https://pluto.vulmix.dev/docs/reference/content-model#singleton-types
   */
  singleton?: boolean | { id?: string }
  /** Build the nav and pages entries of this type from it. Set `false` when the layer declares its own `nav` and `pages`. */
  autoRoutes?: boolean
  /**
   * Base admin path, for example '/admin/posts'. The generic list and form build the "add new"
   * button, the edit links and the redirect after a create from it. Default:
   * `/admin/content/<name>`.
   */
  basePath?: string
  /** The "create new" link of the generic list. Default: `${basePath}/new`. */
  newPath?: string
  /** The edit link, and the redirect after a create, for an id. Default: `${basePath}/${id}`. */
  editPath?: (id: string | number) => string
  /**
   * Buttons of this type in the admin bar, for a user with the `write`
   * capability. `new`: "New <type>" on every page. `edit`: "Edit <type>" on a
   * public page that calls `usePlutoEditLink(type, id)`. `true` gives both.
   * Unset gives none.
   * @see https://pluto.vulmix.dev/docs/reference/content-model#admin-bar-buttons
   */
  adminBar?:
    | boolean
    | {
        new?: boolean
        edit?: boolean
      }
  navOrder?: number
  /**
   * The id of a nav group (the registry bucket `navGroups`), for example
   * `'pluto:pages'`. The bare id of a group (`'pages'`) works when one group
   * has it. The types of a group show as one sidebar item with one link per
   * type, and in one "New" menu of the admin bar. A group with one visible type
   * shows that type as a normal item. An unknown group is ignored. Unset: the
   * type is its own item.
   */
  navGroup?: string
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
   * still run. The build indicator of the edit form (Git CMS) then shows "Live" right after a
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
    /**
     * Keep a backup of the unsaved changes in this browser (`localStorage`), and offer to restore
     * it when the user opens the item again. Default true. Set false for a type whose text must
     * not stay in the browser.
     * @see https://pluto.vulmix.dev/docs/reference/content-model#backups
     */
    backup?: boolean
  }
  /**
   * Options for the file adapters (the Git CMS). Other adapters ignore them. Every member is
   * plain data or a pure function, so the definition is safe on the server and on the client.
   */
  files?: PlutoContentFiles
  /**
   * Server-only hooks. The generic write handlers run them after the adapter call succeeds and
   * before the response goes out.
   * @see https://pluto.vulmix.dev/docs/reference/content-model#hooks
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
 * published items only.
 * @see https://pluto.vulmix.dev/docs/build/public-api
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
 * One stored content item, keyed by field name (not column name).
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

/** Options for a list read. */
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
   * text too (`3` matches `'3'`, `true` matches `'true'`). When the stored value is a list (a
   * `multiple` reference), the item matches when the list has the value.
   */
  filters?: Record<string, string>
  /**
   * Only the items with this status value (a value of `type.status`). An item with no stored status
   * has the default status of the type. A type with no publish workflow ignores it. It does not
   * show unpublished items by itself: core sets `includeUnpublished` too.
   */
  status?: string
  /**
   * Only the items with these ids, in any order. An empty list gives no item. An adapter that
   * ignores it still works: core matches the ids again.
   */
  ids?: Array<string | number>
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
 * Storage for the generic content server routes. A backend layer provides it. One adapter is
 * active per app, registered with `registerContentAdapter`.
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
  /** Throws when the caller of `event` does not hold `capability`. Optional. */
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
   * The saved versions of one item, newest first. Optional: without it, the edit form shows no
   * History. The first entry is the version that the item has now. `cursor` is the `nextCursor`
   * of the page before. The adapter checks that the caller may edit the type. See the
   * @see https://pluto.vulmix.dev/docs/reference/content-model#revisions
   */
  listRevisions?: (
    ctx: PlutoContentContext,
    id: string | number,
    query: {
      limit: number
      cursor?: string
    }
  ) => Promise<PlutoContentRevisionPage>
  /**
   * The item as it was at one revision (an `id` from `listRevisions`). `null` when the item had no
   * such revision. Optional, and needed with `listRevisions`. The `_version` of the answer is the
   * version of that revision: a restore saves with the `_version` of the current item.
   */
  getRevision?: (
    ctx: PlutoContentContext,
    id: string | number,
    revisionId: string
  ) => Promise<PlutoContentItem | null>
  /**
   * The trash. Optional; an adapter that has it implements every method below. For a type with
   * `trash`, the delete route calls `trash` instead of `remove`. A trashed item is not in `list`,
   * `get`, `countCreated`, the public API or the reference expansion, and keeps its id and the
   * references to it until `purge`. Every method needs the delete capability of the type. See the
   * @see https://pluto.vulmix.dev/docs/reference/content-model#trash
   */
  trash?: {
    /** Moves the item to the trash. 404 when it does not exist. */
    move: (ctx: PlutoContentContext, id: string | number) => Promise<void>
    /**
     * The trashed items, the last trashed first. Each item has `_deletedAt` (ISO). `search` matches
     * the title field, without case.
     */
    list: (
      ctx: PlutoContentContext,
      query: {
        limit?: number
        offset?: number
        search?: string
      }
    ) => Promise<PlutoContentListResult>
    /** Moves the item back. 404 when it is not in the trash, 409 when a live item has its id. */
    restore: (
      ctx: PlutoContentContext,
      id: string | number
    ) => Promise<PlutoContentItem>
    /** Deletes a trashed item forever, and removes the references to it. 404 when it is not in the trash. */
    purge: (ctx: PlutoContentContext, id: string | number) => Promise<void>
    /** Deletes forever every item trashed before `before` (ISO). Returns how many. */
    purgeBefore: (ctx: PlutoContentContext, before: string) => Promise<number>
  }
  /**
   * Sets the status of every item of the type that is scheduled for `now` (ISO) or earlier to the
   * published value, and keeps its time. Returns how many. The scheduled task
   * `pluto:publish:scheduled` calls it with a system request, for each type with
   * `status.schedule`. Optional: without it, a scheduled item is live at its time on a server read
   * (`isLiveStatus`), but its status stays `scheduled`.
   */
  publishDue?: (ctx: PlutoContentContext, now: string) => Promise<number>
  /**
   * A server copy of the unsaved changes of the caller, one for each user, type and item.
   * Optional: without it, the form keeps the browser backup only, and the backup routes answer
   * `supported: false`. `key` is the item id as text, or `'+new'` for a new item. The adapter reads
   * the caller from `ctx.event`, and each caller sees only its own copies. The core routes check
   * the write capability of the type before they call it. Core also calls `remove` after a create
   * (`'+new'`), an update (the route id) and a delete, and only warns on an error. See the
   * @see https://pluto.vulmix.dev/docs/reference/content-model#backups
   */
  backups?: {
    /** The copy of the caller, or `null`. */
    get: (
      ctx: PlutoContentContext,
      key: string
    ) => Promise<PlutoContentBackup | null>
    /**
     * Replaces the copy of the caller. `otherDevice` is true when the replaced copy came from
     * another `device` a short time ago (10 minutes).
     */
    put: (
      ctx: PlutoContentContext,
      key: string,
      record: PlutoContentBackup
    ) => Promise<{ otherDevice: boolean }>
    /** Removes the copy of the caller. No error when there is none. */
    remove: (ctx: PlutoContentContext, key: string) => Promise<void>
  }
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

/**
 * An item in a preview, in the shape of the public API: the field values (a media field holds
 * its record, or an array of records for `multiple`), `html` (the body), and the dates as
 * `createdAt`, `updatedAt` and `publishedAt`. See `toPreviewItem`. A preview component can type
 * it with its own fields: `PlutoPreviewItem<{ title: string }>`.
 */
export type PlutoPreviewItem<T extends object = Record<string, unknown>> = T & {
  html: string
  createdAt?: string
  updatedAt?: string
  publishedAt?: string
}

/** What a revision did, when the backend knows it. */
export type PlutoContentRevisionAction =
  'create' | 'update' | 'publish' | 'unpublish' | 'rename'

/** One saved version of an item. See `PlutoContentAdapter.listRevisions`. */
export interface PlutoContentRevision {
  /** Unique for the item, and safe in a URL path segment (a commit sha, a row id). */
  id: string
  /** When the version was saved, an ISO timestamp. */
  createdAt: string
  author?: {
    name: string
    /** The user name on the backend, for example the GitHub login. */
    login?: string
    avatarUrl?: string
  }
  /** What the version did. Without it, the admin shows `message`. */
  action?: PlutoContentRevisionAction
  /** A short text of the backend, for example a commit message that Pluto did not write. */
  message?: string
}

/** One page of revisions, newest first. */
export interface PlutoContentRevisionPage {
  data: PlutoContentRevision[]
  /** Give it back as `cursor` to get the next page. Absent on the last page. */
  nextCursor?: string
}

/** The answer of `GET /api/_pluto/content-revisions/<type>/<id>`. */
export interface PlutoContentRevisionList extends PlutoContentRevisionPage {
  /** False when the backend keeps no revisions. Then `data` is empty. */
  supported: boolean
}

/** The answer of `GET /api/_pluto/content-backup/<type>?id=<id>`, `PUT` and `DELETE`. */
export interface PlutoContentBackupAnswer {
  /** False when the adapter keeps no server copies (the Git CMS). Then nothing else is set. */
  supported: boolean
  /** `GET`: the copy of the caller, or `null`. */
  backup?: PlutoContentBackup | null
  /** `PUT`: the copy that this write replaced came from another device a short time ago. */
  otherDevice?: boolean
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

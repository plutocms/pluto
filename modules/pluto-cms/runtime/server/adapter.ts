import type { H3Event } from 'h3'
import type {
  PlutoContentAdapter,
  PlutoContentContext,
  PlutoContentItem,
  PlutoContentListResult,
  PlutoContentQuery,
  PlutoContentType,
  PlutoField,
} from '../../../../shared/types/content'
import type { PlutoCmsAuth, PlutoCmsFile, PlutoCmsStore } from './store/types'
import type { CmsCache } from './utils/cms-cache'
import { isError, setResponseHeader } from 'h3'
import { createPlutoError } from '../../../../server/utils/pluto-error'
import { compareContentIds } from '../../../../shared/utils/content-id'
import { fieldColumn, mapColumnsToFields } from '../../../../shared/utils/content-map'
import { PlutoCmsConflictError, PlutoCmsStoreError } from './store/errors'
import { gitBlobSha } from './utils/blob-sha'
import { createCmsCache } from './utils/cms-cache'
import {
  assertSafeContentId,
  contentDirPath,
  contentFilePath,
  PlutoCmsPathError,
  slugifyTitle,
  typeRelativePath,
} from './utils/cms-paths'
import { parseMarkdownFile, serializeMarkdownFile } from './utils/markdown-file'

export interface PlutoCmsAccess {
  /** The capability keys the caller holds. */
  capabilities: string[]
  /** The GitHub token the store uses for this caller. */
  auth: PlutoCmsAuth
}

export interface MarkdownContentAdapterOptions {
  store: PlutoCmsStore
  /** The content dir, relative to the repo root. */
  dir: string
  /** Reads the caller of a request. `null` means anonymous. */
  getAccess: (event: H3Event) => Promise<PlutoCmsAccess | null>
  commit?: {
 skipDeploy?: boolean
}
  /** The cache that holds parsed files by blob id. A memory cache by default. */
  cache?: CmsCache
  /** How many times a commit retries after an unrelated change. Default 2. */
  retries?: number
  now?: () => Date
}

interface Entry {
  /** The id: the file name without `.md`, or the nested path. */
  slug: string
  oid: string
  /** The text of the file as stored. */
  text: string
  frontmatter: Record<string, unknown>
  body: string
}

interface ParsedFile {
  frontmatter: Record<string, unknown>
  body: string
}

interface Plan {
  message: string
  additions: {
 path: string
contents: string
}[]
  deletions: {
 path: string
}[]
  /** The files this commit depends on, and their blob id when the plan was made. */
  targets: {
 path: string
oid: string | null
}[]
  item?: PlutoContentItem
  /** The new text equals the stored text. Do not commit. */
  unchanged?: boolean
}

interface Layout {
  nested: boolean
  exclude: string[]
  readFrontmatter?: (frontmatter: Record<string, unknown>) => Record<string, unknown>
  writeFrontmatter?: (frontmatter: Record<string, unknown>) => Record<string, unknown>
  bodyField?: PlutoField
  slugField?: string
  /** Fields stored as frontmatter keys. */
  metaFields: PlutoField[]
  statusColumn?: string
  publishedValue: string
  publishedAtColumn?: string
  createdColumn?: string
  updatedColumn?: string
}

/** The storage keys of one content type. */
function layoutOf(type: PlutoContentType): Layout {
  const bodyField = type.fields.find((field) => field.type === 'richtext' && !field.virtual)
  const slugField = type.slug ? type.slug.field : undefined
  const timestamps = type.timestamps
  const created = timestamps === false ? false : (timestamps?.created ?? 'createdAt')
  const updated = timestamps === false ? false : (timestamps?.updated ?? 'updatedAt')
  return {
    nested: type.files?.nested === true,
    exclude: type.files?.nested ? (type.files.exclude ?? []) : [],
    readFrontmatter: type.files?.frontmatter?.read,
    writeFrontmatter: type.files?.frontmatter?.write,
    bodyField,
    slugField,
    metaFields: type.fields.filter((field) => !field.virtual && field !== bodyField && field.name !== slugField),
    statusColumn: type.status ? (type.status.column ?? 'status') : undefined,
    publishedValue: (type.status && type.status.publishedValue) || 'published',
    publishedAtColumn: type.status ? type.status.publishedAtColumn : undefined,
    createdColumn: created || undefined,
    updatedColumn: updated || undefined,
  }
}

/** The `*` capability means every capability, the same rule as the admin UI. */
function hasCapability(access: PlutoCmsAccess, capability: string): boolean {
  return access.capabilities.includes('*') || access.capabilities.includes(capability)
}

function isEmptyValue(value: unknown): boolean {
  return value === undefined || value === null || value === ''
}

function compareValues(a: unknown, b: unknown): number {
  if (a === b) {
    return 0
  }
  if (a === undefined || a === null) {
    return 1
  }
  if (b === undefined || b === null) {
    return -1
  }
  if (typeof a === 'number' && typeof b === 'number') {
    return a - b
  }
  const left = String(a)
  const right = String(b)
  return left < right ? -1 : left > right ? 1 : 0
}

/** Builds the `PlutoContentAdapter` over a `PlutoCmsStore`. */
export function createMarkdownContentAdapter(options: MarkdownContentAdapterOptions): PlutoContentAdapter {
  const { store, dir, getAccess } = options
  const cache = options.cache ?? createCmsCache({ headTtl: 0 })
  const retries = options.retries ?? 2
  const now = options.now ?? (() => new Date())
  const skipSuffix = options.commit?.skipDeploy ? ' [skip ci]' : ''

  // --- Errors ---------------------------------------------------------------

  function conflictError() {
    return createPlutoError({
      statusCode: 409,
      message: 'This item changed since you opened it. Reload to get the latest version.',
      key: 'pluto.errors.conflict',
    })
  }

  function notFoundError() {
    return createPlutoError({ statusCode: 404, message: 'Not found.', key: 'pluto.errors.notFound' })
  }

  function slugTakenError(slug: string) {
    return createPlutoError({
      statusCode: 409,
      message: `The slug "${slug}" is already in use.`,
      key: 'pluto.cms.errors.slugTaken',
      params: { slug },
    })
  }

  function invalidSlugError() {
    return createPlutoError({
      statusCode: 400,
      message: 'The slug is not valid. Use lowercase letters, numbers and dashes.',
      key: 'pluto.cms.errors.invalidSlug',
    })
  }

  function signInError() {
    return createPlutoError({
      statusCode: 401,
      message: 'Sign in to continue.',
      key: 'pluto.cms.errors.signInRequired',
    })
  }

  function forbiddenError(capability: string) {
    return createPlutoError({
      statusCode: 403,
      message: 'You do not have permission to do this.',
      key: 'pluto.cms.errors.forbidden',
      params: { capability },
    })
  }

  /** Maps any error of the storage layer to an HTTP error. */
  function toHttpError(error: unknown, event: H3Event): unknown {
    if (isError(error)) {
      return error
    }
    if (error instanceof PlutoCmsPathError) {
      return invalidSlugError()
    }
    if (!(error instanceof PlutoCmsStoreError)) {
      return error
    }
    switch (error.code) {
      case 'conflict':
        return conflictError()
      case 'auth':
        return createPlutoError({
          statusCode: 401,
          message: 'GitHub did not accept the sign-in. Sign in again.',
          key: 'pluto.cms.errors.githubAuth',
        })
      case 'forbidden':
        return createPlutoError({
          statusCode: 403,
          message: 'GitHub says you cannot do this in the repo.',
          key: 'pluto.cms.errors.githubForbidden',
        })
      case 'not-found':
        return notFoundError()
      case 'rate-limit': {
        const retryAfter = error.retryAfter === undefined ? undefined : Math.max(1, Math.ceil(error.retryAfter))
        if (retryAfter !== undefined) {
          try {
            setResponseHeader(event, 'Retry-After', retryAfter)
          } catch {
            // A test event has no response. The header is best effort.
          }
        }
        return createPlutoError({
          statusCode: 503,
          message: 'GitHub is limiting requests. Try again soon.',
          key: 'pluto.cms.errors.rateLimited',
          data: { retryAfter },
        })
      }
      default:
        console.error('[pluto-cms] GitHub error:', error)
        return createPlutoError({
          statusCode: 502,
          message: 'GitHub did not answer as expected.',
          key: 'pluto.cms.errors.githubUnavailable',
        })
    }
  }

  async function guard<T>(event: H3Event, run: () => Promise<T>): Promise<T> {
    try {
      return await run()
    } catch (error) {
      throw toHttpError(error, event)
    }
  }

  // --- Access ---------------------------------------------------------------

  async function requireAccess(event: H3Event, capability: string | undefined): Promise<PlutoCmsAccess> {
    const access = await getAccess(event)
    if (!access) {
      throw signInError()
    }
    if (capability && !hasCapability(access, capability)) {
      throw forbiddenError(capability)
    }
    return access
  }

  /** Drafts are visible to a signed-in caller with the read capability. */
  function canSeeDrafts(type: PlutoContentType, access: PlutoCmsAccess | null): boolean {
    if (!access) {
      return false
    }
    const capability = type.capabilities?.read
    return !capability || hasCapability(access, capability)
  }

  // --- Files ----------------------------------------------------------------

  async function parseFile(file: PlutoCmsFile): Promise<ParsedFile | null> {
    const cached = await cache.getBlob<ParsedFile>(file.oid)
    if (cached) {
      return cached
    }
    try {
      const parsed = parseMarkdownFile(file.text)
      await cache.setBlob(file.oid, parsed)
      return parsed
    } catch (error) {
      console.warn(`[pluto-cms] Skipped "${file.path}": ${(error as Error).message}`)
      return null
    }
  }

  /** The options that the path helpers need for one type. */
  function pathOptions(layout: Layout): {
 nested: boolean
} {
    return { nested: layout.nested }
  }

  /** Whether the id is listed in `files.exclude` (an id, or a folder with a trailing slash). */
  function isExcluded(layout: Layout, id: string): boolean {
    return layout.exclude.some((entry) => entry.endsWith('/') ? id.startsWith(entry) : id === entry)
  }

  /** True when the id is a safe id for this type and is not excluded. */
  function isUsableId(layout: Layout, id: string): boolean {
    try {
      assertSafeContentId(id, pathOptions(layout))
    } catch {
      return false
    }
    return !isExcluded(layout, id)
  }

  async function toEntry(layout: Layout, file: PlutoCmsFile, id: string): Promise<Entry | null> {
    if (!isUsableId(layout, id)) {
      return null
    }
    const parsed = await parseFile(file)
    if (!parsed) {
      return null
    }
    // The parsed file is shared through the cache. A hook gets a copy.
    const frontmatter = layout.readFrontmatter
      ? layout.readFrontmatter(structuredClone(parsed.frontmatter))
      : parsed.frontmatter
    return { slug: id, oid: file.oid, text: file.text, frontmatter, body: parsed.body }
  }

  /** The files of one type. A nested type reads the whole tree under its folder. */
  async function listFiles(type: PlutoContentType, layout: Layout, head: string, auth?: PlutoCmsAuth): Promise<PlutoCmsFile[]> {
    const folder = contentDirPath(dir, type.source, pathOptions(layout))
    return layout.nested ? store.listTree(folder, head, auth) : store.listDir(folder, head, auth)
  }

  /** Reads one file. A nested type reads it from the tree, a flat type from the file. */
  async function readTarget(type: PlutoContentType, layout: Layout, head: string, id: string, auth?: PlutoCmsAuth): Promise<PlutoCmsFile | null> {
    const path = contentFilePath(dir, type.source, id, pathOptions(layout))
    if (!layout.nested) {
      return store.readFile(path, head, auth)
    }
    const files = await listFiles(type, layout, head, auth)
    return files.find((file) => file.path === path) ?? null
  }

  async function loadEntries(type: PlutoContentType, access: PlutoCmsAccess | null): Promise<Entry[]> {
    const layout = layoutOf(type)
    const head = await store.head({ auth: access?.auth })
    const files = await listFiles(type, layout, head, access?.auth)
    const prefixLength = contentDirPath(dir, type.source, pathOptions(layout)).length + 1
    const entries = await Promise.all(files.map((file) => toEntry(
      layout,
      file,
      layout.nested ? file.path.slice(prefixLength, -'.md'.length) : file.name.slice(0, -'.md'.length)
    )))
    return entries.filter((entry): entry is Entry => entry !== null)
  }

  async function loadEntry(type: PlutoContentType, access: PlutoCmsAccess | null, slug: string): Promise<Entry | null> {
    const layout = layoutOf(type)
    if (!isUsableId(layout, slug)) {
      return null
    }
    const head = await store.head({ auth: access?.auth })
    const file = await readTarget(type, layout, head, slug, access?.auth)
    return file ? toEntry(layout, file, slug) : null
  }

  function isPublished(type: PlutoContentType, layout: Layout, entry: Entry): boolean {
    if (!layout.statusColumn) {
      return true
    }
    const value = entry.frontmatter[layout.statusColumn] ?? (type.status && type.status.default)
    return value === layout.publishedValue
  }

  function isVisible(type: PlutoContentType, layout: Layout, entry: Entry, drafts: boolean): boolean {
    return drafts || isPublished(type, layout, entry)
  }

  /** One flat row keyed by storage key, the shape `mapColumnsToFields` reads. */
  function toRow(type: PlutoContentType, layout: Layout, entry: Entry): Record<string, unknown> {
    const row: Record<string, unknown> = { ...entry.frontmatter }
    row[type.primaryKey ?? 'id'] = entry.slug
    if (layout.slugField) {
      const slugField = type.fields.find((field) => field.name === layout.slugField)
      row[slugField ? fieldColumn(slugField) : layout.slugField] = entry.slug
    }
    if (layout.bodyField) {
      row[fieldColumn(layout.bodyField)] = entry.body
    }
    return row
  }

  function toItem(type: PlutoContentType, layout: Layout, entry: Entry, withBody: boolean): PlutoContentItem {
    const row = toRow(type, layout, entry)
    const item = mapColumnsToFields(type, row)
    for (const column of [layout.createdColumn, layout.updatedColumn, layout.publishedAtColumn]) {
      if (column && Object.hasOwn(row, column)) {
        item[column] = row[column]
      }
    }
    if (!withBody && layout.bodyField) {
      delete item[layout.bodyField.name]
    }
    item._version = entry.oid
    return item
  }

  // --- Writes ---------------------------------------------------------------

  function messageOf(type: PlutoContentType, verb: string): string {
    return `content(${type.name}): ${verb}${skipSuffix}`
  }

  /** Runs a plan against a fresh head. Retries when only unrelated files changed. */
  async function commitPlan(
    event: H3Event,
    access: PlutoCmsAccess,
    plan: (head: string) => Promise<Plan>
  ): Promise<Plan> {
    let first: Plan['targets'] | undefined
    for (let attempt = 0; ; attempt++) {
      const head = await store.head({ revalidate: true, auth: access.auth })
      const current = await plan(head)
      if (!first) {
        first = current.targets
      } else if (current.targets.some((target, index) => target.oid !== first![index]?.oid)) {
        throw conflictError()
      }
      if (current.unchanged) {
        return current
      }
      try {
        await store.commit({
          expectedHeadOid: head,
          message: current.message,
          additions: current.additions,
          deletions: current.deletions,
        }, access.auth)
        return current
      } catch (error) {
        if (error instanceof PlutoCmsConflictError && attempt < retries) {
          continue
        }
        throw toHttpError(error, event)
      }
    }
  }

  async function readExisting(type: PlutoContentType, access: PlutoCmsAccess, head: string, slug: string): Promise<Entry | null> {
    const layout = layoutOf(type)
    if (!isUsableId(layout, slug)) {
      return null
    }
    const file = await readTarget(type, layout, head, slug, access.auth)
    return file ? toEntry(layout, file, slug) : null
  }

  /** Applies the payload to a frontmatter object. Unknown keys stay. */
  function applyValues(
    type: PlutoContentType,
    layout: Layout,
    frontmatter: Record<string, unknown>,
    values: Record<string, unknown>,
    mode: 'create' | 'update'
  ): void {
    const stamp = now().toISOString()
    for (const field of layout.metaFields) {
      if (!Object.hasOwn(values, field.name)) {
        continue
      }
      const value = values[field.name]
      const column = fieldColumn(field)
      if (isEmptyValue(value)) {
        delete frontmatter[column]
      } else {
        frontmatter[column] = value
      }
    }
    if (layout.statusColumn) {
      if (Object.hasOwn(values, 'status')) {
        const allowed = (type.status ? type.status.values : []).map((entry) => entry.value)
        if (!allowed.includes(String(values.status))) {
          throw createPlutoError({
            statusCode: 400,
            message: 'Validation failed.',
            key: 'pluto.errors.validationFailed',
          })
        }
        frontmatter[layout.statusColumn] = values.status
      } else if (mode === 'create' && type.status && type.status.default !== undefined) {
        frontmatter[layout.statusColumn] = type.status.default
      }
      if (
        layout.publishedAtColumn
        && frontmatter[layout.statusColumn] === layout.publishedValue
        && isEmptyValue(frontmatter[layout.publishedAtColumn])
      ) {
        frontmatter[layout.publishedAtColumn] = stamp
      }
    }
    if (mode === 'create' && layout.createdColumn) {
      frontmatter[layout.createdColumn] = stamp
    }
    if (layout.updatedColumn) {
      frontmatter[layout.updatedColumn] = stamp
    }
  }

  function bodyOf(layout: Layout, values: Record<string, unknown>, fallback: string): string {
    if (layout.bodyField && Object.hasOwn(values, layout.bodyField.name)) {
      const value = values[layout.bodyField.name]
      return typeof value === 'string' ? value : ''
    }
    return fallback
  }

  /** The text of a file. The `files.frontmatter.write` hook maps the frontmatter first. */
  function fileText(layout: Layout, frontmatter: Record<string, unknown>, body: string): string {
    const mapped = layout.writeFrontmatter ? layout.writeFrontmatter(structuredClone(frontmatter)) : frontmatter
    return serializeMarkdownFile(mapped, body)
  }

  function publishCapability(type: PlutoContentType): string | undefined {
    return type.capabilities?.publish ?? type.capabilities?.write
  }

  // --- Adapter methods ------------------------------------------------------

  async function list(ctx: PlutoContentContext, query: PlutoContentQuery): Promise<PlutoContentListResult> {
    return guard(ctx.event, async () => {
      const { type } = ctx
      const layout = layoutOf(type)
      const access = await getAccess(ctx.event)
      const drafts = query.includeUnpublished === true && canSeeDrafts(type, access)

      let entries = (await loadEntries(type, access)).filter((entry) => isVisible(type, layout, entry, drafts))

      if (query.search) {
        const needle = query.search.toLowerCase()
        const titleField = type.fields.find((field) => field.name === type.titleField)
        const titleColumn = titleField ? fieldColumn(titleField) : type.titleField
        entries = entries.filter((entry) => String(entry.frontmatter[titleColumn] ?? '').toLowerCase().includes(needle))
      }

      const sort = query.sort ?? type.defaultSort ?? (layout.nested
        ? { field: 'id', direction: 'asc' as const }
        : { field: layout.createdColumn ?? 'id', direction: 'desc' as const })
      const sortField = type.fields.find((field) => field.name === sort.field)
      const sortKey = sortField ? fieldColumn(sortField) : sort.field
      const direction = sort.direction === 'asc' ? 1 : -1
      entries.sort((a, b) => {
        const left = sortKey === 'id' ? a.slug : a.frontmatter[sortKey]
        const right = sortKey === 'id' ? b.slug : b.frontmatter[sortKey]
        // A missing value always sorts last, in either direction.
        if (isEmptyValue(left) !== isEmptyValue(right)) {
          return isEmptyValue(left) ? 1 : -1
        }
        if (sortKey === 'id' && layout.nested) {
          return compareContentIds(a.slug, b.slug) * direction
        }
        return compareValues(left, right) * direction || (layout.nested ? compareContentIds(a.slug, b.slug) : compareValues(a.slug, b.slug))
      })

      const total = entries.length
      const offset = Math.max(0, query.offset ?? 0)
      const end = query.limit === undefined ? undefined : offset + Math.max(0, query.limit)
      return {
        data: entries.slice(offset, end).map((entry) => toItem(type, layout, entry, false)),
        total,
      }
    })
  }

  async function get(ctx: PlutoContentContext, idOrSlug: string | number): Promise<PlutoContentItem | null> {
    return guard(ctx.event, async () => {
      const { type } = ctx
      const layout = layoutOf(type)
      const access = await getAccess(ctx.event)
      const entry = await loadEntry(type, access, String(idOrSlug))
      if (!entry || !isVisible(type, layout, entry, canSeeDrafts(type, access))) {
        return null
      }
      const item = toItem(type, layout, entry, true)
      // The whole frontmatter of the file, after the `read` hook. A copy: the parse cache shares the original.
      item._frontmatter = structuredClone(entry.frontmatter)
      return item
    })
  }

  /**
   * Reads one raw file of the type, by a path relative to the type folder. An unsafe path gives
   * `null`. A `.md` file follows the rules of `get`: it must be a usable id and visible to the
   * caller, so a draft never reaches an anonymous caller. Another file (for example
   * `.navigation.yml`) is read as it is.
   */
  async function readFile(ctx: PlutoContentContext, relativePath: string): Promise<{
 text: string
version?: string
} | null> {
    return guard(ctx.event, async () => {
      const { type } = ctx
      const layout = layoutOf(type)
      let path: string
      try {
        path = typeRelativePath(contentDirPath(dir, type.source, pathOptions(layout)), relativePath)
      } catch (error) {
        if (error instanceof PlutoCmsPathError) {
          return null
        }
        throw error
      }
      const access = await getAccess(ctx.event)
      const head = await store.head({ auth: access?.auth })
      const file = await store.readFile(path, head, access?.auth)
      if (!file) {
        return null
      }
      if (relativePath.endsWith('.md')) {
        const entry = await toEntry(layout, file, relativePath.slice(0, -'.md'.length))
        if (!entry || !isVisible(type, layout, entry, canSeeDrafts(type, access))) {
          return null
        }
      }
      return { text: file.text, version: file.oid }
    })
  }

  async function create(ctx: PlutoContentContext, values: Record<string, unknown>): Promise<PlutoContentItem> {
    return guard(ctx.event, async () => {
      const { type } = ctx
      const layout = layoutOf(type)
      const access = await requireAccess(ctx.event, type.capabilities?.write)

      const given = layout.slugField ? values[layout.slugField] : undefined
      const slug = typeof given === 'string' && given !== ''
        ? given
        : slugifyTitle(String(values[type.titleField] ?? ''))
      if (!isUsableId(layout, slug)) {
        throw invalidSlugError()
      }
      const path = contentFilePath(dir, type.source, slug, pathOptions(layout))

      const frontmatter: Record<string, unknown> = {}
      applyValues(type, layout, frontmatter, values, 'create')
      if (layout.statusColumn && frontmatter[layout.statusColumn] === layout.publishedValue) {
        await requireAccess(ctx.event, publishCapability(type))
      }
      const body = bodyOf(layout, values, '')
      const text = fileText(layout, frontmatter, body)

      await commitPlan(ctx.event, access, async (head) => {
        const existing = await readTarget(type, layout, head, slug, access.auth)
        if (existing) {
          throw slugTakenError(slug)
        }
        return {
          message: messageOf(type, `create "${slug}"`),
          additions: [{ path, contents: text }],
          deletions: [],
          targets: [{ path, oid: null }],
        }
      })

      return toItem(type, layout, { slug, oid: gitBlobSha(text), text, frontmatter, body }, true)
    })
  }

  async function update(
    ctx: PlutoContentContext,
    id: string | number,
    values: Record<string, unknown>
  ): Promise<PlutoContentItem> {
    return guard(ctx.event, async () => {
      const { type } = ctx
      const layout = layoutOf(type)
      const access = await requireAccess(ctx.event, type.capabilities?.write)
      const oldSlug = String(id)
      if (!isUsableId(layout, oldSlug)) {
        throw notFoundError()
      }

      const given = layout.slugField ? values[layout.slugField] : undefined
      const newSlug = typeof given === 'string' && given !== '' ? given : oldSlug
      if (newSlug !== oldSlug && !isUsableId(layout, newSlug)) {
        throw invalidSlugError()
      }
      const oldPath = contentFilePath(dir, type.source, oldSlug, pathOptions(layout))
      const newPath = contentFilePath(dir, type.source, newSlug, pathOptions(layout))
      const version = typeof values._version === 'string' ? values._version : undefined

      const done = await commitPlan(ctx.event, access, async (head) => {
        const current = await readExisting(type, access, head, oldSlug)
        if (!current) {
          throw notFoundError()
        }
        if (version !== undefined && version !== current.oid) {
          throw conflictError()
        }
        const targets: Plan['targets'] = [{ path: oldPath, oid: current.oid }]
        if (newPath !== oldPath) {
          if (await readTarget(type, layout, head, newSlug, access.auth)) {
            throw slugTakenError(newSlug)
          }
        }

        const frontmatter = { ...current.frontmatter }
        const wasPublished = isPublished(type, layout, current)
        applyValues(type, layout, frontmatter, values, 'update')
        const nowPublished = !layout.statusColumn || frontmatter[layout.statusColumn] === layout.publishedValue
        if (wasPublished !== nowPublished) {
          await requireAccess(ctx.event, publishCapability(type))
        }
        const body = bodyOf(layout, values, current.body)
        const text = fileText(layout, frontmatter, body)

        // A save that changes nothing makes no commit. The `updated` stamp alone is not a change.
        if (newPath === oldPath) {
          const probe = { ...frontmatter }
          if (layout.updatedColumn) {
            if (Object.hasOwn(current.frontmatter, layout.updatedColumn)) {
              probe[layout.updatedColumn] = current.frontmatter[layout.updatedColumn]
            } else {
              delete probe[layout.updatedColumn]
            }
          }
          if (fileText(layout, probe, body) === current.text) {
            return {
              message: '',
              additions: [],
              deletions: [],
              targets,
              unchanged: true,
              item: toItem(type, layout, current, true),
            }
          }
        }

        let verb = `update "${oldSlug}"`
        if (newPath !== oldPath) {
          verb = `rename "${oldSlug}" -> "${newSlug}"`
        } else if (wasPublished !== nowPublished) {
          verb = `${nowPublished ? 'publish' : 'unpublish'} "${oldSlug}"`
        }
        return {
          message: messageOf(type, verb),
          additions: [{ path: newPath, contents: text }],
          deletions: newPath === oldPath ? [] : [{ path: oldPath }],
          targets,
          item: toItem(type, layout, { slug: newSlug, oid: gitBlobSha(text), text, frontmatter, body }, true),
        }
      })
      return done.item as PlutoContentItem
    })
  }

  async function remove(ctx: PlutoContentContext, id: string | number): Promise<void> {
    return guard(ctx.event, async () => {
      const { type } = ctx
      const access = await requireAccess(ctx.event, type.capabilities?.delete)
      const layout = layoutOf(type)
      const slug = String(id)
      if (!isUsableId(layout, slug)) {
        throw notFoundError()
      }
      const path = contentFilePath(dir, type.source, slug, pathOptions(layout))

      await commitPlan(ctx.event, access, async (head) => {
        const current = await readExisting(type, access, head, slug)
        if (!current) {
          throw notFoundError()
        }
        return {
          message: messageOf(type, `delete "${slug}"`),
          additions: [],
          deletions: [{ path }],
          targets: [{ path, oid: current.oid }],
        }
      })
    })
  }

  /** Fails closed: no access gives 401, a missing capability gives 403. */
  async function authorize(event: H3Event, capability: string): Promise<void> {
    await guard(event, async () => {
      await requireAccess(event, capability)
    })
  }

  async function countCreated(ctx: PlutoContentContext, range: {
 from: string
to: string
}): Promise<number | null> {
    return guard(ctx.event, async () => {
      const { type } = ctx
      const layout = layoutOf(type)
      if (!layout.createdColumn) {
        return null
      }
      const access = await getAccess(ctx.event)
      const drafts = canSeeDrafts(type, access)
      const from = Date.parse(range.from)
      const to = Date.parse(range.to)
      const entries = await loadEntries(type, access)
      return entries.filter((entry) => {
        if (!isVisible(type, layout, entry, drafts)) {
          return false
        }
        const created = Date.parse(String(entry.frontmatter[layout.createdColumn!] ?? ''))
        return Number.isFinite(created) && created >= from && created < to
      }).length
    })
  }

  return { id: 'markdown', list, get, create, update, remove, authorize, countCreated, readFile }
}

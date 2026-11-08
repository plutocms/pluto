import type { H3Event } from 'h3'
import type {
  PlutoContentAdapter,
  PlutoContentContext,
  PlutoContentItem,
  PlutoContentListResult,
  PlutoContentQuery,
  PlutoContentRevision,
  PlutoContentRevisionAction,
  PlutoContentRevisionPage,
  PlutoContentType,
  PlutoField,
} from '../../../../shared/types/content'
import type {
  PlutoGithubAuth,
  PlutoGithubFile,
  PlutoGithubStore,
} from './store/types'
import type { GithubCache } from './utils/github-cache'
import { isError, setResponseHeader } from 'h3'
import { listContentTypes } from '../../../../server/utils/pluto-content'
import { createPlutoError } from '../../../../server/utils/pluto-error'
import { compareContentIds } from '../../../../shared/utils/content-id'
import {
  fieldColumn,
  mapColumnsToFields,
} from '../../../../shared/utils/content-map'
import {
  referenceFieldsTo,
  referenceValue,
} from '../../../../shared/utils/content-reference'
import {
  contentStatusValues,
  isLiveStatus,
  scheduleError,
  statusChangeNeedsPublish,
  statusRules,
  statusTime,
} from '../../../../shared/utils/content-status'
import { PlutoGithubConflictError, PlutoGithubStoreError } from './store/errors'
import { gitBlobSha } from './utils/blob-sha'
import { createGithubCache } from './utils/github-cache'
import {
  assertSafeContentId,
  contentDirPath,
  contentFilePath,
  PlutoGithubPathError,
  slugifyTitle,
  trashDirPath,
  trashFilePath,
  typeRelativePath,
} from './utils/github-paths'
import { markdownToPlainText, renderMarkdown } from './utils/markdown'
import { parseMarkdownFile, serializeMarkdownFile } from './utils/markdown-file'

/** The length of an excerpt made from the body, in the public API. */
const EXCERPT_LENGTH = 200

export interface PlutoGithubAccess {
  /** The capability keys the caller holds. */
  capabilities: string[]
  /** The GitHub token the store uses for this caller. */
  auth: PlutoGithubAuth
}

export interface MarkdownContentAdapterOptions {
  store: PlutoGithubStore
  /** The content dir, relative to the repo root. */
  dir: string
  /** Reads the caller of a request. `null` means anonymous. */
  getAccess: (event: H3Event) => Promise<PlutoGithubAccess | null>
  commit?: {
    /**
     * `true`: every commit gets `[skip ci]`. `false`: only a commit that changes no published
     * content gets it (a draft that stays a draft), so a draft save starts no deploy.
     */
    skipDeploy?: boolean
  }
  /** The cache that holds parsed files by blob id. A memory cache by default. */
  cache?: GithubCache
  /**
   * The registered content types. A rename or a delete of an item reads it to find the types
   * that reference the item. Default: the types of the core registry.
   */
  getTypes?: () => PlutoContentType[]
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
  readFrontmatter?: (
    frontmatter: Record<string, unknown>
  ) => Record<string, unknown>
  writeFrontmatter?: (
    frontmatter: Record<string, unknown>
  ) => Record<string, unknown>
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
  const bodyField = type.fields.find(
    (field) => field.type === 'richtext' && !field.virtual
  )
  const slugField = type.slug ? type.slug.field : undefined
  const timestamps = type.timestamps
  const created =
    timestamps === false ? false : (timestamps?.created ?? 'createdAt')
  const updated =
    timestamps === false ? false : (timestamps?.updated ?? 'updatedAt')
  return {
    nested: type.files?.nested === true,
    exclude: type.files?.nested ? (type.files.exclude ?? []) : [],
    readFrontmatter: type.files?.frontmatter?.read,
    writeFrontmatter: type.files?.frontmatter?.write,
    bodyField,
    slugField,
    metaFields: type.fields.filter(
      (field) =>
        !field.virtual && field !== bodyField && field.name !== slugField
    ),
    statusColumn: type.status ? (type.status.column ?? 'status') : undefined,
    publishedValue: (type.status && type.status.publishedValue) || 'published',
    publishedAtColumn: type.status ? type.status.publishedAtColumn : undefined,
    createdColumn: created || undefined,
    updatedColumn: updated || undefined,
  }
}

// A commit message of the adapter: `content(post): update "slug"`. See `messageOf`.
const PLUTO_MESSAGE =
  /^content\([^)]*\): (create|update|publish|unpublish|rename|schedule|submit)\b/

/** A schedule and a submit for review are updates in the history. */
const REVISION_ACTION: Record<string, PlutoContentRevisionAction> = {
  schedule: 'update',
  submit: 'update',
}

/** A history commit as a revision: the action of a Pluto commit, or the message of any other. */
function toRevision(commit: {
  oid: string
  message: string
  committedAt: string
  author: PlutoContentRevision['author']
}): PlutoContentRevision {
  const verb = PLUTO_MESSAGE.exec(commit.message)?.[1]
  const action = verb
    ? (REVISION_ACTION[verb] ?? (verb as PlutoContentRevisionAction))
    : undefined
  const message = commit.message.replace(/\s*\[skip ci\]\s*$/, '')
  return {
    id: commit.oid,
    createdAt: commit.committedAt,
    ...(commit.author?.name && { author: commit.author }),
    ...(action ? { action } : { message }),
  }
}

/** The `*` capability means every capability, the same rule as the admin UI. */
function hasCapability(access: PlutoGithubAccess, capability: string): boolean {
  return (
    access.capabilities.includes('*') ||
    access.capabilities.includes(capability)
  )
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

/** Builds the `PlutoContentAdapter` over a `PlutoGithubStore`. */
export function createMarkdownContentAdapter(
  options: MarkdownContentAdapterOptions
): PlutoContentAdapter {
  const { store, dir, getAccess } = options
  const cache = options.cache ?? createGithubCache({ headTtl: 0 })
  const retries = options.retries ?? 2
  const getTypes = options.getTypes ?? listContentTypes
  const now = options.now ?? (() => new Date())
  const skipAll = options.commit?.skipDeploy === true

  // --- Errors ---------------------------------------------------------------

  function conflictError() {
    return createPlutoError({
      statusCode: 409,
      message:
        'This item changed since you opened it. Reload to get the latest version.',
      key: 'pluto.errors.conflict',
    })
  }

  function notFoundError() {
    return createPlutoError({
      statusCode: 404,
      message: 'Not found.',
      key: 'pluto.errors.notFound',
    })
  }

  function slugTakenError(slug: string) {
    return createPlutoError({
      statusCode: 409,
      message: `The slug "${slug}" is already in use.`,
      key: 'pluto.github.errors.slugTaken',
      params: { slug },
    })
  }

  function invalidSlugError() {
    return createPlutoError({
      statusCode: 400,
      message:
        'The slug is not valid. Use lowercase letters, numbers and dashes.',
      key: 'pluto.github.errors.invalidSlug',
    })
  }

  function signInError() {
    return createPlutoError({
      statusCode: 401,
      message: 'Sign in to continue.',
      key: 'pluto.github.errors.signInRequired',
    })
  }

  function forbiddenError(capability: string) {
    return createPlutoError({
      statusCode: 403,
      message: 'You do not have permission to do this.',
      key: 'pluto.github.errors.forbidden',
      params: { capability },
    })
  }

  /** Maps any error of the storage layer to an HTTP error. */
  function toHttpError(error: unknown, event: H3Event): unknown {
    if (isError(error)) {
      return error
    }
    if (error instanceof PlutoGithubPathError) {
      return invalidSlugError()
    }
    if (!(error instanceof PlutoGithubStoreError)) {
      return error
    }
    switch (error.code) {
      case 'conflict':
        return conflictError()
      case 'auth':
        return createPlutoError({
          statusCode: 401,
          message: 'GitHub did not accept the sign-in. Sign in again.',
          key: 'pluto.github.errors.githubAuth',
        })
      case 'forbidden':
        return createPlutoError({
          statusCode: 403,
          message: 'GitHub says you cannot do this in the repo.',
          key: 'pluto.github.errors.githubForbidden',
        })
      case 'not-found':
        return notFoundError()
      case 'rate-limit': {
        const retryAfter =
          error.retryAfter === undefined
            ? undefined
            : Math.max(1, Math.ceil(error.retryAfter))
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
          key: 'pluto.github.errors.rateLimited',
          data: { retryAfter },
        })
      }
      default:
        console.error('[pluto-github] GitHub error:', error)
        return createPlutoError({
          statusCode: 502,
          message: 'GitHub did not answer as expected.',
          key: 'pluto.github.errors.githubUnavailable',
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

  async function requireAccess(
    event: H3Event,
    capability: string | undefined
  ): Promise<PlutoGithubAccess> {
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
  function canSeeDrafts(
    type: PlutoContentType,
    access: PlutoGithubAccess | null
  ): boolean {
    if (!access) {
      return false
    }
    const capability = type.capabilities?.read
    return !capability || hasCapability(access, capability)
  }

  // --- Files ----------------------------------------------------------------

  async function parseFile(file: PlutoGithubFile): Promise<ParsedFile | null> {
    const cached = await cache.getBlob<ParsedFile>(file.oid)
    if (cached) {
      return cached
    }
    try {
      const parsed = parseMarkdownFile(file.text)
      await cache.setBlob(file.oid, parsed)
      return parsed
    } catch (error) {
      console.warn(
        `[pluto-github] Skipped "${file.path}": ${(error as Error).message}`
      )
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
    return layout.exclude.some((entry) =>
      entry.endsWith('/') ? id.startsWith(entry) : id === entry
    )
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

  async function toEntry(
    layout: Layout,
    file: PlutoGithubFile,
    id: string
  ): Promise<Entry | null> {
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
    return {
      slug: id,
      oid: file.oid,
      text: file.text,
      frontmatter,
      body: parsed.body,
    }
  }

  /** The files of one type. A nested type reads the whole tree under its folder. */
  async function listFiles(
    type: PlutoContentType,
    layout: Layout,
    head: string,
    auth?: PlutoGithubAuth
  ): Promise<PlutoGithubFile[]> {
    const folder = contentDirPath(dir, type.source, pathOptions(layout))
    return layout.nested
      ? store.listTree(folder, head, auth)
      : store.listDir(folder, head, auth)
  }

  /** Reads one file. A nested type reads it from the tree, a flat type from the file. */
  async function readTarget(
    type: PlutoContentType,
    layout: Layout,
    head: string,
    id: string,
    auth?: PlutoGithubAuth
  ): Promise<PlutoGithubFile | null> {
    const path = contentFilePath(dir, type.source, id, pathOptions(layout))
    if (!layout.nested) {
      return store.readFile(path, head, auth)
    }
    const files = await listFiles(type, layout, head, auth)
    return files.find((file) => file.path === path) ?? null
  }

  async function loadEntries(
    type: PlutoContentType,
    access: PlutoGithubAccess | null,
    atHead?: string
  ): Promise<Entry[]> {
    const layout = layoutOf(type)
    const head = atHead ?? (await store.head({ auth: access?.auth }))
    const files = await listFiles(type, layout, head, access?.auth)
    const prefixLength =
      contentDirPath(dir, type.source, pathOptions(layout)).length + 1
    const entries = await Promise.all(
      files.map((file) =>
        toEntry(
          layout,
          file,
          layout.nested
            ? file.path.slice(prefixLength, -'.md'.length)
            : file.name.slice(0, -'.md'.length)
        )
      )
    )
    return entries.filter((entry): entry is Entry => entry !== null)
  }

  async function loadEntry(
    type: PlutoContentType,
    access: PlutoGithubAccess | null,
    slug: string
  ): Promise<Entry | null> {
    const layout = layoutOf(type)
    if (!isUsableId(layout, slug)) {
      return null
    }
    const head = await store.head({ auth: access?.auth })
    const file = await readTarget(type, layout, head, slug, access?.auth)
    return file ? toEntry(layout, file, slug) : null
  }

  /** The status of an entry. A file with no status key has the default status of the type. */
  function statusOf(
    type: PlutoContentType,
    layout: Layout,
    entry: Pick<Entry, 'frontmatter'>
  ): unknown {
    return layout.statusColumn
      ? (entry.frontmatter[layout.statusColumn] ??
          (type.status && type.status.default))
      : undefined
  }

  function isPublished(
    type: PlutoContentType,
    layout: Layout,
    entry: Pick<Entry, 'frontmatter'>
  ): boolean {
    if (!layout.statusColumn) {
      return true
    }
    const status = statusOf(type, layout, entry)
    // Only a scheduled item reads the clock.
    if (status !== statusRules(type)?.scheduled) {
      return status === layout.publishedValue
    }
    return isLiveStatus(
      type,
      status,
      layout.publishedAtColumn
        ? entry.frontmatter[layout.publishedAtColumn]
        : undefined,
      now().getTime()
    )
  }

  function isVisible(
    type: PlutoContentType,
    layout: Layout,
    entry: Entry,
    drafts: boolean
  ): boolean {
    return drafts || isPublished(type, layout, entry)
  }

  /** One flat row keyed by storage key, the shape `mapColumnsToFields` reads. */
  function toRow(
    type: PlutoContentType,
    layout: Layout,
    entry: Entry
  ): Record<string, unknown> {
    const row: Record<string, unknown> = { ...entry.frontmatter }
    row[type.primaryKey ?? 'id'] = entry.slug
    if (layout.slugField) {
      const slugField = type.fields.find(
        (field) => field.name === layout.slugField
      )
      row[slugField ? fieldColumn(slugField) : layout.slugField] = entry.slug
    }
    if (layout.bodyField) {
      row[fieldColumn(layout.bodyField)] = entry.body
    }
    return row
  }

  function toItem(
    type: PlutoContentType,
    layout: Layout,
    entry: Entry,
    withBody: boolean
  ): PlutoContentItem {
    const row = toRow(type, layout, entry)
    const item = mapColumnsToFields(type, row)
    for (const column of [
      layout.createdColumn,
      layout.updatedColumn,
      layout.publishedAtColumn,
    ]) {
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

  /**
   * The commit message. `publicChange` is false when the commit changes no published content:
   * the item is a draft before and after. Such a commit gets `[skip ci]`, so it starts no deploy.
   */
  function messageOf(
    type: PlutoContentType,
    verb: string,
    publicChange: boolean
  ): string {
    const skip = skipAll || !publicChange ? ' [skip ci]' : ''
    return `content(${type.name}): ${verb}${skip}`
  }

  /** Runs a plan against a fresh head. Retries when only unrelated files changed. */
  async function commitPlan(
    event: H3Event,
    access: PlutoGithubAccess,
    plan: (head: string) => Promise<Plan>
  ): Promise<Plan> {
    let first: Plan['targets'] | undefined
    for (let attempt = 0; ; attempt++) {
      const head = await store.head({ revalidate: true, auth: access.auth })
      const current = await plan(head)
      if (!first) {
        first = current.targets
      } else if (
        current.targets.some(
          (target, index) => target.oid !== first![index]?.oid
        )
      ) {
        throw conflictError()
      }
      if (current.unchanged) {
        return current
      }
      try {
        await store.commit(
          {
            expectedHeadOid: head,
            message: current.message,
            additions: current.additions,
            deletions: current.deletions,
          },
          access.auth
        )
        return current
      } catch (error) {
        if (error instanceof PlutoGithubConflictError && attempt < retries) {
          continue
        }
        throw toHttpError(error, event)
      }
    }
  }

  async function readExisting(
    type: PlutoContentType,
    access: PlutoGithubAccess,
    head: string,
    slug: string
  ): Promise<Entry | null> {
    const layout = layoutOf(type)
    if (!isUsableId(layout, slug)) {
      return null
    }
    const file = await readTarget(type, layout, head, slug, access.auth)
    return file ? toEntry(layout, file, slug) : null
  }

  /**
   * The files of the items that reference items of the type `target`, rewritten by `changes`:
   * each old id becomes its new id, or leaves the field when the new id is null. Drafts count too.
   * The body, the unknown keys and the stamps of each file stay. A list that ends empty drops its
   * key. Files that hold no reference are not in the answer. The changed items are not rewritten.
   */
  async function referenceRewrites(
    head: string,
    access: PlutoGithubAccess,
    target: PlutoContentType,
    changes: Map<string, string | null>
  ): Promise<{
    additions: Plan['additions']
    targets: Plan['targets']
    published: boolean
  }> {
    const result: Awaited<ReturnType<typeof referenceRewrites>> = {
      additions: [],
      targets: [],
      published: false,
    }
    for (const type of getTypes()) {
      const fields = referenceFieldsTo(type, target.name)
      if (fields.length === 0) {
        continue
      }
      const layout = layoutOf(type)
      const files = await listFiles(type, layout, head, access.auth)
      const prefixLength =
        contentDirPath(dir, type.source, pathOptions(layout)).length + 1
      for (const file of files) {
        const id = layout.nested
          ? file.path.slice(prefixLength, -'.md'.length)
          : file.name.slice(0, -'.md'.length)
        if (type.name === target.name && changes.has(id)) {
          continue
        }
        const entry = await toEntry(layout, file, id)
        if (!entry) {
          continue
        }
        const frontmatter = { ...entry.frontmatter }
        let changed = false
        for (const field of fields) {
          const column = fieldColumn(field)
          if (!Object.hasOwn(frontmatter, column)) {
            continue
          }
          const ids = referenceValue(frontmatter[column])
          if (!ids.some((one) => changes.has(String(one)))) {
            continue
          }
          changed = true
          const next: Array<string | number> = []
          for (const one of ids) {
            const replacement = changes.has(String(one))
              ? changes.get(String(one))!
              : one
            if (
              replacement !== null &&
              !next.some((have) => String(have) === String(replacement))
            ) {
              next.push(replacement)
            }
          }
          if (next.length === 0) {
            delete frontmatter[column]
          } else {
            frontmatter[column] = Array.isArray(frontmatter[column])
              ? next
              : next[0]
          }
        }
        if (!changed) {
          continue
        }
        const path = contentFilePath(dir, type.source, id, pathOptions(layout))
        result.additions.push({
          path,
          contents: fileText(layout, frontmatter, entry.body),
        })
        result.targets.push({ path, oid: entry.oid })
        result.published ||= isPublished(type, layout, entry)
      }
    }
    return result
  }

  /**
   * The publish time. A scheduled save sets the planned time (`values.publishAt`, in the future);
   * a scheduled item that keeps its status keeps its time when the payload has no new one. Publish
   * now of a scheduled item stamps the time now, and a scheduled item that goes back to a draft or
   * to review loses its time. Else the first publish stamps the time, as before.
   */
  function applyPublishTime(
    type: PlutoContentType,
    column: string,
    frontmatter: Record<string, unknown>,
    before: unknown,
    after: unknown,
    values: Record<string, unknown>,
    stamp: string
  ): void {
    const rules = statusRules(type)!
    const scheduled = rules.scheduled
    if (scheduled !== undefined && after === scheduled) {
      if (before !== scheduled || Object.hasOwn(values, 'publishAt')) {
        const key = scheduleError(type, values.publishAt, now().getTime())
        if (key) {
          throw createPlutoError({
            statusCode: 400,
            message: 'The schedule time is not valid.',
            key,
          })
        }
        frontmatter[column] = new Date(
          statusTime(values.publishAt)!
        ).toISOString()
      }
      return
    }
    if (scheduled !== undefined && before === scheduled) {
      if (after === rules.published) {
        frontmatter[column] = stamp
      } else {
        delete frontmatter[column]
      }
      return
    }
    if (after === rules.published && isEmptyValue(frontmatter[column])) {
      frontmatter[column] = stamp
    }
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
      // An empty list leaves the frontmatter, like an empty value.
      if (isEmptyValue(value) || (Array.isArray(value) && value.length === 0)) {
        delete frontmatter[column]
      } else {
        frontmatter[column] = value
      }
    }
    if (layout.statusColumn) {
      const before =
        mode === 'create' ? undefined : statusOf(type, layout, { frontmatter })
      if (Object.hasOwn(values, 'status')) {
        const allowed = contentStatusValues(type).map((entry) => entry.value)
        if (!allowed.includes(String(values.status))) {
          throw createPlutoError({
            statusCode: 400,
            message: 'Validation failed.',
            key: 'pluto.errors.validationFailed',
          })
        }
        frontmatter[layout.statusColumn] = values.status
      } else if (
        mode === 'create' &&
        type.status &&
        type.status.default !== undefined
      ) {
        frontmatter[layout.statusColumn] = type.status.default
      }
      if (layout.publishedAtColumn) {
        applyPublishTime(
          type,
          layout.publishedAtColumn,
          frontmatter,
          before,
          frontmatter[layout.statusColumn],
          values,
          stamp
        )
      }
    }
    if (mode === 'create' && layout.createdColumn) {
      frontmatter[layout.createdColumn] = stamp
    }
    if (layout.updatedColumn) {
      frontmatter[layout.updatedColumn] = stamp
    }
  }

  function bodyOf(
    layout: Layout,
    values: Record<string, unknown>,
    fallback: string
  ): string {
    if (layout.bodyField && Object.hasOwn(values, layout.bodyField.name)) {
      const value = values[layout.bodyField.name]
      return typeof value === 'string' ? value : ''
    }
    return fallback
  }

  /** The text of a file. The `files.frontmatter.write` hook maps the frontmatter first. */
  function fileText(
    layout: Layout,
    frontmatter: Record<string, unknown>,
    body: string
  ): string {
    const mapped = layout.writeFrontmatter
      ? layout.writeFrontmatter(structuredClone(frontmatter))
      : frontmatter
    return serializeMarkdownFile(mapped, body)
  }

  /** `schedule` or `submit` when an update sets the scheduled or the review status. */
  function statusVerb(
    type: PlutoContentType,
    layout: Layout,
    current: Pick<Entry, 'frontmatter'>,
    frontmatter: Record<string, unknown>
  ): 'schedule' | 'submit' | undefined {
    const rules = statusRules(type)
    if (!rules || !layout.statusColumn) {
      return undefined
    }
    const after = frontmatter[layout.statusColumn]
    if (after === statusOf(type, layout, current)) {
      return undefined
    }
    if (rules.scheduled !== undefined && after === rules.scheduled) {
      return 'schedule'
    }
    return rules.review !== undefined && after === rules.review
      ? 'submit'
      : undefined
  }

  function publishCapability(type: PlutoContentType): string | undefined {
    return type.capabilities?.publish ?? type.capabilities?.write
  }

  // --- Adapter methods ------------------------------------------------------

  async function list(
    ctx: PlutoContentContext,
    query: PlutoContentQuery
  ): Promise<PlutoContentListResult> {
    return guard(ctx.event, async () => {
      const { type } = ctx
      const layout = layoutOf(type)
      const access = await getAccess(ctx.event)
      const drafts =
        query.includeUnpublished === true && canSeeDrafts(type, access)

      let entries = (await loadEntries(type, access)).filter((entry) =>
        isVisible(type, layout, entry, drafts)
      )

      // Only one status. A type with no publish workflow has no status, so the option does nothing.
      if (query.status !== undefined && layout.statusColumn) {
        entries = entries.filter(
          (entry) => String(statusOf(type, layout, entry)) === query.status
        )
      }

      if (query.search) {
        const needle = query.search.toLowerCase()
        const titleField = type.fields.find(
          (field) => field.name === type.titleField
        )
        const titleColumn = titleField
          ? fieldColumn(titleField)
          : type.titleField
        entries = entries.filter((entry) =>
          String(entry.frontmatter[titleColumn] ?? '')
            .toLowerCase()
            .includes(needle)
        )
      }

      if (query.ids) {
        const wanted = new Set(query.ids.map(String))
        entries = entries.filter((entry) => wanted.has(entry.slug))
      }

      // Equality filters compare the text of the value, because the public API sends text. A list
      // (a `multiple` reference) matches when it has the value.
      const filters = Object.entries(query.filters ?? {})
      if (filters.length > 0) {
        entries = entries.filter((entry) => {
          const item = toItem(type, layout, entry, false)
          return filters.every(([name, value]) => {
            const stored = item[name]
            return Array.isArray(stored)
              ? stored.some((one) => String(one) === value)
              : String(stored ?? '') === value
          })
        })
      }

      const sort =
        query.sort ??
        type.defaultSort ??
        (layout.nested
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
        return (
          compareValues(left, right) * direction ||
          (layout.nested
            ? compareContentIds(a.slug, b.slug)
            : compareValues(a.slug, b.slug))
        )
      })

      const total = entries.length
      const offset = Math.max(0, query.offset ?? 0)
      const end =
        query.limit === undefined
          ? undefined
          : offset + Math.max(0, query.limit)
      return {
        data: entries
          .slice(offset, end)
          .map((entry) => toItem(type, layout, entry, false)),
        total,
      }
    })
  }

  async function get(
    ctx: PlutoContentContext,
    idOrSlug: string | number
  ): Promise<PlutoContentItem | null> {
    return guard(ctx.event, async () => {
      const { type } = ctx
      const layout = layoutOf(type)
      const access = await getAccess(ctx.event)
      const entry = await loadEntry(type, access, String(idOrSlug))
      if (
        !entry ||
        !isVisible(type, layout, entry, canSeeDrafts(type, access))
      ) {
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
  async function readFile(
    ctx: PlutoContentContext,
    relativePath: string
  ): Promise<{
    text: string
    version?: string
  } | null> {
    return guard(ctx.event, async () => {
      const { type } = ctx
      const layout = layoutOf(type)
      let path: string
      try {
        path = typeRelativePath(
          contentDirPath(dir, type.source, pathOptions(layout)),
          relativePath
        )
      } catch (error) {
        if (error instanceof PlutoGithubPathError) {
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
        const entry = await toEntry(
          layout,
          file,
          relativePath.slice(0, -'.md'.length)
        )
        if (
          !entry ||
          !isVisible(type, layout, entry, canSeeDrafts(type, access))
        ) {
          return null
        }
      }
      return { text: file.text, version: file.oid }
    })
  }

  async function create(
    ctx: PlutoContentContext,
    values: Record<string, unknown>
  ): Promise<PlutoContentItem> {
    return guard(ctx.event, async () => {
      const { type } = ctx
      const layout = layoutOf(type)
      const access = await requireAccess(ctx.event, type.capabilities?.write)

      const given = layout.slugField ? values[layout.slugField] : undefined
      const slug =
        typeof given === 'string' && given !== ''
          ? given
          : slugifyTitle(String(values[type.titleField] ?? ''))
      if (!isUsableId(layout, slug)) {
        throw invalidSlugError()
      }
      const path = contentFilePath(dir, type.source, slug, pathOptions(layout))

      const frontmatter: Record<string, unknown> = {}
      applyValues(type, layout, frontmatter, values, 'create')
      // A published item (or a type with no status) is public: its commit starts a deploy.
      const published = isPublished(type, layout, { frontmatter })
      if (
        layout.statusColumn &&
        statusChangeNeedsPublish(
          type,
          undefined,
          frontmatter[layout.statusColumn]
        )
      ) {
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
          message: messageOf(type, `create "${slug}"`, published),
          additions: [{ path, contents: text }],
          deletions: [],
          targets: [{ path, oid: null }],
        }
      })

      return toItem(
        type,
        layout,
        { slug, oid: gitBlobSha(text), text, frontmatter, body },
        true
      )
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
      const newSlug =
        typeof given === 'string' && given !== '' ? given : oldSlug
      if (newSlug !== oldSlug && !isUsableId(layout, newSlug)) {
        throw invalidSlugError()
      }
      const oldPath = contentFilePath(
        dir,
        type.source,
        oldSlug,
        pathOptions(layout)
      )
      const newPath = contentFilePath(
        dir,
        type.source,
        newSlug,
        pathOptions(layout)
      )
      const version =
        typeof values._version === 'string' ? values._version : undefined

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
        const nowPublished = isPublished(type, layout, { frontmatter })
        if (
          layout.statusColumn &&
          statusChangeNeedsPublish(
            type,
            statusOf(type, layout, current),
            frontmatter[layout.statusColumn]
          )
        ) {
          await requireAccess(ctx.event, publishCapability(type))
        }
        const body = bodyOf(layout, values, current.body)
        const text = fileText(layout, frontmatter, body)

        // A save that changes nothing makes no commit. The `updated` stamp alone is not a change.
        if (newPath === oldPath) {
          const probe = { ...frontmatter }
          if (layout.updatedColumn) {
            if (Object.hasOwn(current.frontmatter, layout.updatedColumn)) {
              probe[layout.updatedColumn] =
                current.frontmatter[layout.updatedColumn]
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
        // A rename also rewrites the items that reference the old id, in the same commit.
        const rewrites =
          newPath === oldPath
            ? undefined
            : await referenceRewrites(
                head,
                access,
                type,
                new Map([[oldSlug, newSlug]])
              )
        if (newPath !== oldPath) {
          verb = `rename "${oldSlug}" -> "${newSlug}"`
          if (rewrites && rewrites.additions.length > 0) {
            verb += ` (${rewrites.additions.length} references)`
          }
        } else if (statusVerb(type, layout, current, frontmatter)) {
          verb = `${statusVerb(type, layout, current, frontmatter)} "${oldSlug}"`
        } else if (wasPublished !== nowPublished) {
          verb = `${nowPublished ? 'publish' : 'unpublish'} "${oldSlug}"`
        }
        return {
          message: messageOf(
            type,
            verb,
            wasPublished || nowPublished || rewrites?.published === true
          ),
          additions: [
            { path: newPath, contents: text },
            ...(rewrites?.additions ?? []),
          ],
          deletions: newPath === oldPath ? [] : [{ path: oldPath }],
          targets: [...targets, ...(rewrites?.targets ?? [])],
          item: toItem(
            type,
            layout,
            { slug: newSlug, oid: gitBlobSha(text), text, frontmatter, body },
            true
          ),
        }
      })
      return done.item as PlutoContentItem
    })
  }

  async function remove(
    ctx: PlutoContentContext,
    id: string | number
  ): Promise<void> {
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
        // The items that reference the deleted id lose it, in the same commit.
        const rewrites = await referenceRewrites(
          head,
          access,
          type,
          new Map([[slug, null]])
        )
        const count = rewrites.additions.length
        return {
          message: messageOf(
            type,
            `delete "${slug}"${count > 0 ? ` (${count} references)` : ''}`,
            isPublished(type, layout, current) || rewrites.published
          ),
          additions: rewrites.additions,
          deletions: [{ path }],
          targets: [{ path, oid: current.oid }, ...rewrites.targets],
        }
      })
    })
  }

  // --- Trash ----------------------------------------------------------------
  //
  // A trashed item is its file in `<dir>/.trash/<type name>/<id>.md`, with the time it went there
  // in the frontmatter key `deletedAt`. The tree reads skip dot folders, so `list`, `get` and the
  // public API do not see it. The references to it stay until the purge.

  /** The frontmatter key of a trashed file: the time it went to the trash (ISO). */
  const TRASH_KEY = 'deletedAt'

  interface TrashEntry {
    entry: Entry
    path: string
    /** The time it went to the trash, in ms. `NaN` when the file has no valid `deletedAt`. */
    deletedAt: number
  }

  /** The trashed files of one type, at `head`. */
  async function trashEntries(
    type: PlutoContentType,
    layout: Layout,
    head: string,
    auth?: PlutoGithubAuth
  ): Promise<TrashEntry[]> {
    const folder = trashDirPath(dir, type.name)
    const files = layout.nested
      ? await store.listTree(folder, head, auth)
      : await store.listDir(folder, head, auth)
    const result: TrashEntry[] = []
    for (const file of files) {
      const id = layout.nested
        ? file.path.slice(folder.length + 1, -'.md'.length)
        : file.name.slice(0, -'.md'.length)
      const entry = await toEntry(layout, file, id)
      const parsed = entry ? await parseFile(file) : null
      if (!entry || !parsed) {
        continue
      }
      result.push({
        entry,
        path: file.path,
        deletedAt: Date.parse(String(parsed.frontmatter[TRASH_KEY] ?? '')),
      })
    }
    return result
  }

  /** The trashed file of one item, at `head`, or `null`. */
  async function readTrashed(
    type: PlutoContentType,
    layout: Layout,
    head: string,
    id: string,
    auth?: PlutoGithubAuth
  ): Promise<TrashEntry | null> {
    if (!isUsableId(layout, id)) {
      return null
    }
    const path = trashFilePath(dir, type.name, id, pathOptions(layout))
    const file = await store.readFile(path, head, auth)
    const entry = file ? await toEntry(layout, file, id) : null
    const parsed = file && entry ? await parseFile(file) : null
    return entry && parsed
      ? {
          entry,
          path,
          deletedAt: Date.parse(String(parsed.frontmatter[TRASH_KEY] ?? '')),
        }
      : null
  }

  /** The text of a file with `deletedAt` set, or removed. The raw frontmatter, not the mapped one. */
  function withTrashKey(text: string, deletedAt: string | null): string {
    const raw = parseMarkdownFile(text)
    const frontmatter = { ...raw.frontmatter }
    if (deletedAt === null) {
      delete frontmatter[TRASH_KEY]
    } else {
      frontmatter[TRASH_KEY] = deletedAt
    }
    return serializeMarkdownFile(frontmatter, raw.body)
  }

  /** The reference rewrites of a purge: none for an id that a live item has again. */
  async function purgeRewrites(
    head: string,
    access: PlutoGithubAccess,
    type: PlutoContentType,
    ids: string[]
  ): ReturnType<typeof referenceRewrites> {
    const changes = new Map<string, string | null>()
    for (const id of ids) {
      if (!(await readExisting(type, access, head, id))) {
        changes.set(id, null)
      }
    }
    return changes.size > 0
      ? referenceRewrites(head, access, type, changes)
      : { additions: [], targets: [], published: false }
  }

  async function moveToTrash(
    ctx: PlutoContentContext,
    id: string | number
  ): Promise<void> {
    return guard(ctx.event, async () => {
      const { type } = ctx
      const access = await requireAccess(ctx.event, type.capabilities?.delete)
      const layout = layoutOf(type)
      const slug = String(id)
      if (!isUsableId(layout, slug)) {
        throw notFoundError()
      }
      const path = contentFilePath(dir, type.source, slug, pathOptions(layout))
      const target = trashFilePath(dir, type.name, slug, pathOptions(layout))

      await commitPlan(ctx.event, access, async (head) => {
        const current = await readExisting(type, access, head, slug)
        if (!current) {
          throw notFoundError()
        }
        // An older trashed copy with the same id is replaced.
        return {
          message: messageOf(
            type,
            `trash "${slug}"`,
            isPublished(type, layout, current)
          ),
          additions: [
            {
              path: target,
              contents: withTrashKey(current.text, now().toISOString()),
            },
          ],
          deletions: [{ path }],
          targets: [{ path, oid: current.oid }],
        }
      })
    })
  }

  async function listTrash(
    ctx: PlutoContentContext,
    query: {
      limit?: number
      offset?: number
      search?: string
    }
  ): Promise<PlutoContentListResult> {
    return guard(ctx.event, async () => {
      const { type } = ctx
      const access = await requireAccess(ctx.event, type.capabilities?.delete)
      const layout = layoutOf(type)
      const head = await store.head({ auth: access.auth })
      let entries = await trashEntries(type, layout, head, access.auth)

      if (query.search) {
        const needle = query.search.toLowerCase()
        const titleField = type.fields.find(
          (field) => field.name === type.titleField
        )
        const titleColumn = titleField
          ? fieldColumn(titleField)
          : type.titleField
        entries = entries.filter((trashed) =>
          String(trashed.entry.frontmatter[titleColumn] ?? '')
            .toLowerCase()
            .includes(needle)
        )
      }

      // The last trashed first. A file with no valid time goes last.
      entries.sort(
        (a, b) =>
          (Number.isNaN(b.deletedAt) ? -Infinity : b.deletedAt) -
            (Number.isNaN(a.deletedAt) ? -Infinity : a.deletedAt) ||
          compareValues(a.entry.slug, b.entry.slug)
      )

      const total = entries.length
      const offset = Math.max(0, query.offset ?? 0)
      const end =
        query.limit === undefined
          ? undefined
          : offset + Math.max(0, query.limit)
      return {
        data: entries.slice(offset, end).map((trashed) => ({
          ...toItem(type, layout, trashed.entry, false),
          _deletedAt: Number.isNaN(trashed.deletedAt)
            ? null
            : new Date(trashed.deletedAt).toISOString(),
        })),
        total,
      }
    })
  }

  async function restore(
    ctx: PlutoContentContext,
    id: string | number
  ): Promise<PlutoContentItem> {
    return guard(ctx.event, async () => {
      const { type } = ctx
      const access = await requireAccess(ctx.event, type.capabilities?.delete)
      const layout = layoutOf(type)
      const slug = String(id)
      if (!isUsableId(layout, slug)) {
        throw notFoundError()
      }
      const path = contentFilePath(dir, type.source, slug, pathOptions(layout))

      const done = await commitPlan(ctx.event, access, async (head) => {
        const trashed = await readTrashed(type, layout, head, slug, access.auth)
        if (!trashed) {
          throw notFoundError()
        }
        if (await readExisting(type, access, head, slug)) {
          throw slugTakenError(slug)
        }
        const text = withTrashKey(trashed.entry.text, null)
        const oid = gitBlobSha(text)
        const entry = await toEntry(
          layout,
          { path, name: path.split('/').pop()!, oid, text },
          slug
        )
        if (!entry) {
          throw notFoundError()
        }
        return {
          message: messageOf(
            type,
            `restore "${slug}"`,
            isPublished(type, layout, entry)
          ),
          additions: [{ path, contents: text }],
          deletions: [{ path: trashed.path }],
          targets: [
            { path: trashed.path, oid: trashed.entry.oid },
            { path, oid: null },
          ],
          item: toItem(type, layout, entry, true),
        }
      })
      return done.item as PlutoContentItem
    })
  }

  async function purge(
    ctx: PlutoContentContext,
    id: string | number
  ): Promise<void> {
    return guard(ctx.event, async () => {
      const { type } = ctx
      const access = await requireAccess(ctx.event, type.capabilities?.delete)
      const layout = layoutOf(type)
      const slug = String(id)
      if (!isUsableId(layout, slug)) {
        throw notFoundError()
      }

      await commitPlan(ctx.event, access, async (head) => {
        const trashed = await readTrashed(type, layout, head, slug, access.auth)
        if (!trashed) {
          throw notFoundError()
        }
        // The items that reference the purged id lose it, in the same commit.
        const rewrites = await purgeRewrites(head, access, type, [slug])
        const count = rewrites.additions.length
        return {
          message: messageOf(
            type,
            `purge "${slug}"${count > 0 ? ` (${count} references)` : ''}`,
            rewrites.published
          ),
          additions: rewrites.additions,
          deletions: [{ path: trashed.path }],
          targets: [
            { path: trashed.path, oid: trashed.entry.oid },
            ...rewrites.targets,
          ],
        }
      })
    })
  }

  async function purgeBefore(
    ctx: PlutoContentContext,
    before: string
  ): Promise<number> {
    return guard(ctx.event, async () => {
      const { type } = ctx
      const access = await requireAccess(ctx.event, type.capabilities?.delete)
      const layout = layoutOf(type)
      const limit = Date.parse(before)
      let purged = 0

      await commitPlan(ctx.event, access, async (head) => {
        // A file with no valid time stays: nobody knows when it went to the trash.
        const expired = (
          await trashEntries(type, layout, head, access.auth)
        ).filter((trashed) => trashed.deletedAt < limit)
        purged = expired.length
        const rewrites = await purgeRewrites(
          head,
          access,
          type,
          expired.map((trashed) => trashed.entry.slug)
        )
        return {
          message: messageOf(
            type,
            `purge ${expired.length} from the trash`,
            rewrites.published
          ),
          additions: rewrites.additions,
          deletions: expired.map((trashed) => ({ path: trashed.path })),
          targets: [
            ...expired.map((trashed) => ({
              path: trashed.path,
              oid: trashed.entry.oid,
            })),
            ...rewrites.targets,
          ],
          unchanged: expired.length === 0,
        }
      })
      return purged
    })
  }

  /**
   * Publishes the scheduled items whose time is `at` or earlier, in one commit. The item keeps its
   * planned time. The commit is a public change, so it starts a deploy (unless every commit skips
   * it). Needs the publish capability: the scheduled task gives a system request.
   */
  async function publishDue(
    ctx: PlutoContentContext,
    at: string
  ): Promise<number> {
    return guard(ctx.event, async () => {
      const { type } = ctx
      const rules = statusRules(type)
      const layout = layoutOf(type)
      const statusColumn = layout.statusColumn
      const timeColumn = layout.publishedAtColumn
      if (!rules?.scheduled || !statusColumn || !timeColumn) {
        return 0
      }
      const access = await requireAccess(ctx.event, publishCapability(type))
      const limit = Date.parse(at)
      let published = 0

      await commitPlan(ctx.event, access, async (head) => {
        const due = (await loadEntries(type, access, head)).filter(
          (entry) =>
            statusOf(type, layout, entry) === rules.scheduled &&
            (statusTime(entry.frontmatter[timeColumn]) ?? Infinity) <= limit
        )
        published = due.length
        const paths = due.map((entry) =>
          contentFilePath(dir, type.source, entry.slug, pathOptions(layout))
        )
        return {
          message: messageOf(type, `publish ${due.length} scheduled`, true),
          additions: due.map((entry, index) => ({
            path: paths[index]!,
            contents: fileText(
              layout,
              { ...entry.frontmatter, [statusColumn]: rules.published },
              entry.body
            ),
          })),
          deletions: [],
          targets: due.map((entry, index) => ({
            path: paths[index]!,
            oid: entry.oid,
          })),
          unchanged: due.length === 0,
        }
      })
      return published
    })
  }

  /** Fails closed: no access gives 401, a missing capability gives 403. */
  async function authorize(event: H3Event, capability: string): Promise<void> {
    await guard(event, async () => {
      await requireAccess(event, capability)
    })
  }

  async function countCreated(
    ctx: PlutoContentContext,
    range: {
      from: string
      to: string
    }
  ): Promise<number | null> {
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
        const created = Date.parse(
          String(entry.frontmatter[layout.createdColumn!] ?? '')
        )
        return Number.isFinite(created) && created >= from && created < to
      }).length
    })
  }

  /** The item keys of the timestamps: the frontmatter keys that `toItem` copies. */
  function timestampKeys(type: PlutoContentType): {
    created?: string
    updated?: string
    published?: string
  } {
    const layout = layoutOf(type)
    return {
      created: layout.createdColumn,
      updated: layout.updatedColumn,
      published: layout.publishedAtColumn,
    }
  }

  /**
   * Keeps a text made from a file in the cache, by the blob id of the file. A blob id never
   * changes, so the entry never goes stale. Without a blob id, nothing is cached.
   */
  async function cachedByBlob(
    prefix: string,
    oid: string | undefined,
    make: () => string
  ): Promise<string> {
    if (!oid) {
      return make()
    }
    const key = `${prefix}:${oid}`
    const cached = await cache.getBlob<string>(key)
    if (typeof cached === 'string') {
      return cached
    }
    const value = make()
    await cache.setBlob(key, value)
    return value
  }

  /**
   * The public answer of a Markdown item. A list item has no body, and it has `excerpt`: the
   * `excerpt` value of the item when it has text, else the start of the body as plain text. One
   * item keeps the Markdown body, and adds `html`: the body rendered and sanitized.
   */
  async function toPublic(
    ctx: PlutoContentContext,
    data: Record<string, unknown>,
    info: {
      view: 'list' | 'item'
      item: PlutoContentItem
      batch: PlutoContentItem[]
    }
  ): Promise<Record<string, unknown>> {
    const bodyField = layoutOf(ctx.type).bodyField
    if (!bodyField) {
      return data
    }
    const result = { ...data }
    if (info.view === 'item') {
      const body = info.item[bodyField.name]
      result.html =
        typeof body === 'string' && body !== ''
          ? await cachedByBlob('html', info.item._version, () =>
              renderMarkdown(body)
            )
          : ''
      return result
    }

    delete result[bodyField.name]
    const own = info.item.excerpt
    if (typeof own === 'string' && own.trim() !== '') {
      result.excerpt = own.trim()
      return result
    }
    // A list item has no body. Read the file: the cache has it.
    const full = await get(ctx, info.item.id)
    const body = full?.[bodyField.name]
    result.excerpt =
      typeof body === 'string' && body !== ''
        ? await cachedByBlob('excerpt', full?._version, () =>
            markdownToPlainText(body, EXCERPT_LENGTH)
          )
        : ''
    return result
  }

  /**
   * The commits that changed the file of one item, newest first. Only an editor (the type write
   * capability) reads them. A store with no history (the build snapshot) gives an empty page.
   * Renames are not followed: the history starts at the last rename.
   */
  async function listRevisions(
    ctx: PlutoContentContext,
    id: string | number,
    query: {
      limit: number
      cursor?: string
    }
  ): Promise<PlutoContentRevisionPage> {
    return guard(ctx.event, async () => {
      const { type } = ctx
      const access = await requireAccess(ctx.event, type.capabilities?.write)
      const layout = layoutOf(type)
      const slug = String(id)
      if (!store.history || !isUsableId(layout, slug)) {
        return { data: [] }
      }
      const path = contentFilePath(dir, type.source, slug, pathOptions(layout))
      const page = await store.history(path, query, access.auth)
      return {
        data: page.commits.map(toRevision),
        ...(page.nextCursor && { nextCursor: page.nextCursor }),
      }
    })
  }

  /** The item as the file was at one commit. A draft follows the rule of `get`. */
  async function getRevision(
    ctx: PlutoContentContext,
    id: string | number,
    revisionId: string
  ): Promise<PlutoContentItem | null> {
    return guard(ctx.event, async () => {
      const { type } = ctx
      const access = await requireAccess(ctx.event, type.capabilities?.write)
      const layout = layoutOf(type)
      const slug = String(id)
      if (!store.readAt || !isUsableId(layout, slug)) {
        return null
      }
      const path = contentFilePath(dir, type.source, slug, pathOptions(layout))
      const file = await store.readAt(path, revisionId, access.auth)
      const entry = file ? await toEntry(layout, file, slug) : null
      if (
        !entry ||
        !isVisible(type, layout, entry, canSeeDrafts(type, access))
      ) {
        return null
      }
      return toItem(type, layout, entry, true)
    })
  }

  return {
    id: 'markdown',
    list,
    get,
    listRevisions,
    getRevision,
    create,
    update,
    remove,
    trash: {
      move: moveToTrash,
      list: listTrash,
      restore,
      purge,
      purgeBefore,
    },
    publishDue,
    authorize,
    countCreated,
    readFile,
    timestampKeys,
    toPublic,
  }
}

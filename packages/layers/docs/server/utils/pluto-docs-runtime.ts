import type { MDCParserResult } from '@nuxtjs/mdc'
import type { H3Event } from 'h3'
import type {
  ManifestDiff,
  RuntimeFolderConfig,
  RuntimeNavItem,
  RuntimeNavPage,
  RuntimeSurroundItem,
} from '../../shared/utils/runtime-content'
import { createHash } from 'node:crypto'
import {
  queryCollection,
  queryCollectionItemSurroundings,
  queryCollectionNavigation,
} from '@nuxt/content/server'
import { parseMarkdown } from '@nuxtjs/mdc/runtime'
import { getQuery, getRouterParam, setResponseHeader } from 'h3'
// The build manifest. The module makes this virtual module at build time. See modules/pluto-docs/manifest.ts.
import manifests from '#pluto-docs/manifest'
import { parseNavigationConfig } from '../../shared/utils/navigation-config'
import {
  diffManifest,
  frontmatterExtras,
} from '../../shared/utils/runtime-content'

// The server side of the `hybrid` and `runtime` render modes. The module adds the routes
// only in these modes. The logic is here, in plain functions, and the handlers in
// `server/handlers/` only call it. See the docs-setup skill.
//
// `runtime`: every answer comes from the content adapter that core registered (the GitHub
// CMS store with its cache).
// `hybrid`: the answer comes from the build data (Nuxt Content, `queryCollection` on the
// server) while the store has the same files as the build manifest. A changed or a new
// page comes from the store. When any file differs, the navigation and the surround come
// from the store. A removed page is a 404. A store error gives the build data.

const STALE_WHILE_REVALIDATE = 300
const PARSED_CACHE_SIZE = 200
const SNAPSHOT_CACHE_SIZE = 20
const COLLECTION_PATTERN = /^[A-Z][\w-]{0,63}$/i
const NAVIGATION_FILE = '.navigation.yml'

/** The page that the page route sends. The shape follows a Nuxt Content page. */
export interface PlutoRuntimePage {
  id: string
  stem: string
  extension: 'md'
  path: string
  title: string
  description: string
  seo: { title?: string; description?: string; [key: string]: unknown }
  navigation?: false | { title?: string; icon?: string; [key: string]: unknown }
  meta: Record<string, unknown>
  body: MDCParserResult['body'] & { toc?: MDCParserResult['toc'] }
  /** The other frontmatter keys of the file, at the top level, like the schema keys of Nuxt Content. */
  [key: string]: unknown
}

interface RuntimeContext {
  type: PlutoContentType
  prefix: string
  mode: 'hybrid' | 'runtime'
  /** The Nuxt Content collection for the build data (hybrid). */
  collection: string | undefined
}

/** The public config of the layer. The site may type its runtime config in its own way, so the code reads it through this type. */
interface PublicConfig {
  render: string
  runtimeMaxAge?: number
  types: Array<{ name: string; routePrefix?: string }>
}

type Manifests = Record<string, Record<string, string>> | undefined

function notFound(): Error {
  return createPlutoError({
    statusCode: 404,
    message: 'Not found.',
    key: 'pluto.errors.notFound',
  })
}

function queryText(event: H3Event, key: string): string {
  const value = getQuery(event)[key]
  return typeof value === 'string' ? value : ''
}

/**
 * Checks the request and gives the type. A public read is always anonymous: the session
 * cookie is never read, so every visitor gets the same answer and a CDN may cache it.
 */
function runtimeContext(event: H3Event): RuntimeContext {
  markPublicRead(event)
  const config = useRuntimeConfig(event).public.plutoDocs as unknown as
    PublicConfig | undefined
  const name = getRouterParam(event, 'type') ?? ''
  const entry =
    config?.render === 'hybrid' || config?.render === 'runtime'
      ? config.types.find((type) => type.name === name)
      : undefined
  const type = entry ? getContentType(name) : undefined
  if (!config || !entry || !type) {
    throw notFound()
  }
  const collection = queryText(event, 'collection')
  return {
    type,
    prefix: entry.routePrefix ?? '',
    mode: config.render as 'hybrid' | 'runtime',
    collection: COLLECTION_PATTERN.test(collection) ? collection : undefined,
  }
}

function setCacheHeaders(event: H3Event): void {
  const configured = Number(
    (
      useRuntimeConfig(event).public.plutoDocs as unknown as
        PublicConfig | undefined
    )?.runtimeMaxAge
  )
  const maxAge =
    Number.isFinite(configured) && configured >= 0 ? configured : 10
  const swr = Math.min(STALE_WHILE_REVALIDATE, Math.max(maxAge * 3, 1))
  setResponseHeader(
    event,
    'Cache-Control',
    maxAge === 0
      ? 'no-store'
      : `public, s-maxage=${maxAge}, stale-while-revalidate=${swr}`
  )
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Every page of the type, in tree order, without the body. */
async function listPages(
  event: H3Event,
  type: PlutoContentType
): Promise<PlutoContentItem[]> {
  const result = await requireContentAdapter().list(
    { event, type },
    { sort: type.defaultSort, includeUnpublished: false }
  )
  return result.data
}

function toNavPage(item: PlutoContentItem): RuntimeNavPage {
  return {
    id: String(item.id),
    title: text(item.title),
    description: text(item.description) || undefined,
    navigationTitle: text(item.navigationTitle) || undefined,
    navigationIcon: text(item.navigationIcon) || undefined,
    navigationHidden: item.navigationHidden === true,
  }
}

// --- The store state against the build manifest ------------------------------

interface Snapshot {
  items: PlutoContentItem[]
  ids: string[]
  diff: ManifestDiff
}

/** Lists the store and compares it with the manifest. */
async function takeSnapshot(
  event: H3Event,
  type: PlutoContentType
): Promise<Snapshot> {
  const items = await listPages(event, type)
  const manifest = (manifests as Manifests)?.[type.name]
  const diff = diffManifest(
    manifest,
    items.map((item) => ({ id: String(item.id), version: item._version }))
  )
  return { items, ids: items.map((item) => String(item.id)), diff }
}

/**
 * The snapshot, or `undefined` when the answer must come from the build data: the mode is
 * hybrid and the store failed (no App, rate limit, outage). In `runtime` mode the error goes up.
 */
async function snapshotOrFallback(
  event: H3Event,
  context: RuntimeContext
): Promise<Snapshot | undefined> {
  try {
    return await takeSnapshot(event, context.type)
  } catch (error) {
    if (context.mode === 'hybrid') {
      console.warn(
        '[pluto-docs] The store failed. The build data answers.',
        (error as Error).message
      )
      return undefined
    }
    throw error
  }
}

// --- The parser --------------------------------------------------------------

type Highlighter =
  NonNullable<
    NonNullable<Parameters<typeof parseMarkdown>[1]>['highlight']
  > extends infer H
    ? H extends { highlighter?: infer F }
      ? F
      : never
    : never

let highlighterPromise: Promise<Highlighter> | undefined

/**
 * The code highlighter of `@nuxtjs/mdc`, made at build time with the themes and the
 * languages of the site. The default highlighter of the parser asks the `/api/_mdc/highlight`
 * route, which Nuxt Content turns off. So the parser gets this one.
 */
function getHighlighter(): Promise<Highlighter> {
  // eslint-disable-next-line ts/ban-ts-comment
  // @ts-ignore The module is a Nitro alias of @nuxtjs/mdc. It has no type file.
  highlighterPromise ??= import('#mdc-highlighter').then(
    (module) => module.default as Highlighter
  )
  return highlighterPromise
}

// Parsing is the slow part. The cache is by blob id (`_version`), which never changes for
// one text, so an entry never goes stale. A new text has a new blob id.
const parsedCache = new Map<string, Promise<MDCParserResult>>()

function parseBody(
  version: string | undefined,
  body: string
): Promise<MDCParserResult> {
  const toc = (
    useRuntimeConfig().plutoDocs as
      { toc?: { depth?: number; searchDepth?: number } } | undefined
  )?.toc
  const parse = async () =>
    parseMarkdown(body, {
      ...(toc && { toc }),
      highlight: { highlighter: await getHighlighter() },
    })
  if (!version) {
    return parse()
  }
  const hit = parsedCache.get(version)
  if (hit) {
    return hit
  }
  const promise = parse()
  parsedCache.set(version, promise)
  promise.catch(() => parsedCache.delete(version))
  if (parsedCache.size > PARSED_CACHE_SIZE) {
    parsedCache.delete(parsedCache.keys().next().value as string)
  }
  return promise
}

// --- Folder configs (.navigation.yml) ----------------------------------------

/** The folders of the ids: every parent path, once (`a/b/c` gives `a` and `a/b`). */
function folderPaths(ids: string[]): string[] {
  const folders = new Set<string>()
  for (const id of ids) {
    const parts = id.split('/').slice(0, -1)
    parts.forEach((_part, index) =>
      folders.add(parts.slice(0, index + 1).join('/'))
    )
  }
  return [...folders]
}

const foldersCache = new Map<string, Record<string, RuntimeFolderConfig>>()

/**
 * The `.navigation.yml` of each folder of the type, read through the adapter (cached by blob in
 * core). The result is cached here by the listing (ids and versions), so a request with an
 * unchanged listing reads no file. An adapter without `readFile` gives no configs.
 */
async function readFolderConfigs(
  event: H3Event,
  type: PlutoContentType,
  items: PlutoContentItem[]
): Promise<Record<string, RuntimeFolderConfig>> {
  const adapter = requireContentAdapter()
  if (!adapter.readFile) {
    return {}
  }
  const hash = createHash('sha1')
  for (const item of items) {
    hash.update(`${item.id}\0${item._version ?? ''}\n`)
  }
  const key = `${type.name}:${hash.digest('hex')}`
  const hit = foldersCache.get(key)
  if (hit) {
    return hit
  }
  const configs: Record<string, RuntimeFolderConfig> = {}
  await Promise.all(
    folderPaths(items.map((item) => String(item.id))).map(async (folder) => {
      const file = await adapter.readFile!(
        { event, type },
        `${folder}/${NAVIGATION_FILE}`
      )
      const config = file ? parseNavigationConfig(file.text) : undefined
      if (config) {
        configs[folder] = config
      }
    })
  )
  foldersCache.set(key, configs)
  if (foldersCache.size > SNAPSHOT_CACHE_SIZE) {
    foldersCache.delete(foldersCache.keys().next().value as string)
  }
  return configs
}

async function storeTree(
  event: H3Event,
  context: RuntimeContext,
  items: PlutoContentItem[],
  withDescription: boolean
): Promise<RuntimeNavItem[]> {
  const folders = await readFolderConfigs(event, context.type, items)
  return buildNavigationTree(items.map(toNavPage), {
    routePrefix: context.prefix,
    includeRoot: queryText(event, 'includeRoot') === '1',
    withDescription,
    folders,
  })
}

// --- The page ----------------------------------------------------------------

/** The page from the store: the text is parsed and the frontmatter passes whole. */
async function storePage(
  event: H3Event,
  context: RuntimeContext,
  id: string
): Promise<PlutoRuntimePage | null> {
  const item = await requireContentAdapter().get(
    { event, type: context.type },
    id
  )
  if (!item) {
    return null
  }
  const parsed = await parseBody(item._version, text(item.body))
  const frontmatter = isRecord(item._frontmatter) ? item._frontmatter : {}
  const extras = frontmatterExtras(frontmatter)

  const title = text(item.title) || text(parsed.data?.title)
  const description = text(item.description) || text(parsed.data?.description)
  // Like Nuxt Content: the seo title and description default to the page ones.
  const seo: PlutoRuntimePage['seo'] = {
    ...(isRecord(frontmatter.seo) ? frontmatter.seo : {}),
    title: text(item.seoTitle) || title,
    description: text(item.seoDescription) || description,
  }
  const rawNavigation = frontmatter.navigation
  const navigation: PlutoRuntimePage['navigation'] =
    rawNavigation === false || item.navigationHidden === true
      ? false
      : isRecord(rawNavigation)
        ? rawNavigation
        : undefined

  return {
    ...extras.top,
    id: `${context.type.name}:${id}.md`,
    stem: id,
    extension: 'md',
    path: contentRoutePath(id, context.prefix),
    title,
    description,
    seo,
    ...(navigation !== undefined && { navigation }),
    meta: extras.meta,
    body: { ...parsed.body, toc: parsed.toc },
  }
}

/** The page from the build data (Nuxt Content), or `null`. */
async function buildPage(
  event: H3Event,
  collection: string,
  path: string
): Promise<unknown> {
  try {
    return await queryCollection(event, collection as never)
      .path(path)
      .first()
  } catch (error) {
    console.warn(
      '[pluto-docs] The build data failed.',
      (error as Error).message
    )
    return null
  }
}

/** `GET /api/pluto/v1/docs/:type/page?path=/a/b&collection=docs` */
export async function plutoRuntimePage(event: H3Event): Promise<unknown> {
  const context = runtimeContext(event)
  const path = queryText(event, 'path')
  setCacheHeaders(event)

  const snapshot = await snapshotOrFallback(event, context)
  if (!snapshot) {
    // The store failed in hybrid mode.
    const page = context.collection
      ? await buildPage(event, context.collection, path)
      : null
    if (!page) {
      throw notFound()
    }
    return page
  }

  const id = pageIdForRoute(snapshot.ids, path, context.prefix)
  if (!id) {
    // Not in the store. A page of the manifest was removed. Another page may be outside the type.
    if (context.mode === 'hybrid' && context.collection) {
      const built = Object.keys(
        (manifests as Manifests)?.[context.type.name] ?? {}
      )
      if (!pageIdForRoute(built, path, context.prefix)) {
        const page = await buildPage(event, context.collection, path)
        if (page) {
          return page
        }
      }
    }
    throw notFound()
  }

  const stale =
    snapshot.diff.changed.includes(id) || snapshot.diff.added.includes(id)
  if (context.mode === 'hybrid' && !stale && context.collection) {
    const page = await buildPage(event, context.collection, path)
    if (page) {
      return page
    }
  }
  const page = await storePage(event, context, id)
  if (!page) {
    throw notFound()
  }
  return page
}

/** `GET /api/pluto/v1/docs/:type/navigation?collection=docs&includeRoot=1` */
export async function plutoRuntimeNavigation(event: H3Event): Promise<unknown> {
  const context = runtimeContext(event)
  setCacheHeaders(event)
  const snapshot = await snapshotOrFallback(event, context)
  if (
    context.mode === 'hybrid' &&
    context.collection &&
    (!snapshot || snapshot.diff.same)
  ) {
    return await queryCollectionNavigation(event, context.collection as never)
  }
  if (!snapshot) {
    throw notFound()
  }
  return await storeTree(event, context, snapshot.items, false)
}

/** `GET /api/pluto/v1/docs/:type/surround?path=/a/b&collection=docs&includeRoot=1` */
export async function plutoRuntimeSurround(
  event: H3Event
): Promise<Array<RuntimeSurroundItem | null> | unknown> {
  const context = runtimeContext(event)
  setCacheHeaders(event)
  const path = queryText(event, 'path').replace(/(?<=.)\/+$/, '')
  const snapshot = await snapshotOrFallback(event, context)
  if (
    context.mode === 'hybrid' &&
    context.collection &&
    (!snapshot || snapshot.diff.same)
  ) {
    return await queryCollectionItemSurroundings(
      event,
      context.collection as never,
      path,
      { fields: ['description'] as never }
    )
  }
  if (!snapshot) {
    throw notFound()
  }
  return surroundOf(await storeTree(event, context, snapshot.items, true), path)
}

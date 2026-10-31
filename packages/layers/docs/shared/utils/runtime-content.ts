// The pure part of the run-time render mode. No Nuxt import, so plain Vitest tests it.
// It turns the flat list of pages of a type into what Nuxt Content gives at build time:
// the navigation tree and the previous and next page. The tree follows the algorithm of
// `generateNavigationTree` in Nuxt Content, so a site can use the same components.
// See the docs-setup skill.

import { contentRoutePath } from './content-route'

/** The fields of a page that the navigation needs. They come from the docs type fields. */
export interface RuntimeNavPage {
  /** The content id, for example `2.core/03.content-model`. */
  id: string
  title: string
  description?: string
  navigationTitle?: string
  navigationIcon?: string
  navigationHidden?: boolean
}

/** A node of the navigation tree. The shape of `ContentNavigationItem` of Nuxt Content. */
export interface RuntimeNavItem {
  title: string
  path: string
  stem: string
  children?: RuntimeNavItem[]
  /** `false` for a folder that has no index page. */
  page?: false
  icon?: string
  description?: string
  /** Other keys of a `.navigation.yml` file, as Nuxt Content passes them. */
  [key: string]: unknown
}

/** A neighbor page for the surround. */
export interface RuntimeSurroundItem {
  title: string
  path: string
  stem: string
  description?: string
}

const INDEX_STEM = /(?:[1-9]\d*\.)?index/

/** `getting-started` gives `Getting Started`. Nuxt Content names a folder without an index page this way. */
export function titleFromSegment(segment: string): string {
  return segment
    .split(/[\s-]/g)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

/** Whether the id is the root page of the source (`index`, or `1.index`). */
export function isRootIndexId(id: string): boolean {
  return !id.includes('/') && INDEX_STEM.test(id)
}

/**
 * The parsed `.navigation.yml` of a folder. Nuxt Content reads `title`, `navigation` (`false` hides
 * the folder, an object overrides the keys) and passes every other key (`icon`, ...) to the folder item.
 */
export type RuntimeFolderConfig = Record<string, unknown>

/** The keys that Nuxt Content keeps as page fields. They do not go to the folder item as they are. */
const FOLDER_PAGE_KEYS = new Set([
  'title',
  'description',
  'seo',
  'navigation',
  'path',
  'id',
  'stem',
  'extension',
  'body',
])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * The keys that a folder config puts on its navigation item, like `pickConfigNavigationFields`
 * of Nuxt Content: the title, then the other keys, then the `navigation` object.
 */
export function folderItemFields(
  config: RuntimeFolderConfig | undefined
): Record<string, unknown> {
  if (!config) {
    return {}
  }
  const out: Record<string, unknown> = {}
  if (
    typeof config.title === 'string' &&
    config.title !== '' &&
    config.title.toLowerCase() !== 'navigation'
  ) {
    out.title = config.title
  }
  for (const [key, value] of Object.entries(config)) {
    if (!FOLDER_PAGE_KEYS.has(key)) {
      out[key] = value
    }
  }
  if (isRecord(config.navigation)) {
    Object.assign(out, config.navigation)
  }
  return out
}

export interface RuntimeNavOptions {
  /** The `.navigation.yml` configs, by folder id path (`2.core`, `2.core/1.sub`). */
  folders?: Record<string, RuntimeFolderConfig>
  /** The route prefix of the type, for example `/docs`. */
  routePrefix?: string
  /** Keep the root `index` page in the tree. Default false: it is the landing page. */
  includeRoot?: boolean
  /** Copy the page description to each item. The surround needs it. Default false. */
  withDescription?: boolean
}

/** Whether the folder config of this folder, or of a parent folder, hides it. */
function isInHiddenFolder(
  id: string,
  folders: Record<string, RuntimeFolderConfig> | undefined
): boolean {
  if (!folders) {
    return false
  }
  const parts = id.split('/').slice(0, -1)
  return parts.some(
    (_part, index) =>
      folders[parts.slice(0, index + 1).join('/')]?.navigation === false
  )
}

function visiblePages(
  pages: RuntimeNavPage[],
  options: RuntimeNavOptions
): RuntimeNavPage[] {
  return pages.filter(
    (page) =>
      page.navigationHidden !== true &&
      (options.includeRoot === true || !isRootIndexId(page.id)) &&
      !isInHiddenFolder(page.id, options.folders)
  )
}

/**
 * Builds the navigation tree from the pages, in the order given (the tree order of ids).
 * A page with `navigationHidden` is left out. The root `index` page is left out unless
 * `includeRoot` is set. A folder takes the title of its index page. A folder with no
 * index page gets a title from its name and `page: false`.
 */
export function buildNavigationTree(
  pages: RuntimeNavPage[],
  options: RuntimeNavOptions = {}
): RuntimeNavItem[] {
  const prefix = options.routePrefix ?? ''
  const nav: RuntimeNavItem[] = []

  for (const page of visiblePages(pages, options)) {
    const path = contentRoutePath(page.id, prefix)
    const prefixParts = prefix.split('/').filter(Boolean)
    const parts = path.substring(1).split('/').slice(prefixParts.length)
    const idParts = page.id.split('/')
    const isIndex = INDEX_STEM.test(idParts.at(-1) ?? '')

    const makeItem = (): RuntimeNavItem => ({
      title: page.navigationTitle || page.title,
      path,
      stem: page.id,
      children: [],
      ...(page.navigationIcon ? { icon: page.navigationIcon } : {}),
      ...(options.withDescription && page.description
        ? { description: page.description }
        : {}),
    })
    const item = makeItem()
    if (isIndex && path !== (prefix || '/')) {
      item.children!.push(makeItem())
      // The config of the folder wins over the title and the icon of its index page.
      Object.assign(
        item,
        folderItemFields(options.folders?.[idParts.slice(0, -1).join('/')])
      )
    }

    // A page at the top level of the source.
    if (parts.length <= 1) {
      const placeholder = isIndex
        ? nav.find((node) => node.path === item.path && node.page === false)
        : undefined
      if (placeholder) {
        Object.assign(placeholder, {
          page: undefined,
          children: [...(item.children ?? []), ...(placeholder.children ?? [])],
        })
      } else {
        nav.push(item)
      }
      continue
    }

    // Walk down the folders. A missing folder becomes a placeholder.
    let siblings = nav
    for (const [index, part] of parts.slice(0, -1).entries()) {
      const folderPath = contentRoutePath(
        idParts.slice(0, index + 1).join('/'),
        prefix
      )
      let parent = siblings.find((node) => node.path === folderPath)
      if (!parent) {
        const fields = folderItemFields(
          options.folders?.[idParts.slice(0, index + 1).join('/')]
        )
        parent = {
          ...fields,
          title:
            typeof fields.title === 'string' && fields.title
              ? fields.title
              : titleFromSegment(part),
          path: folderPath,
          stem: idParts.slice(0, index + 1).join('/'),
          children: [],
          page: false,
        }
        siblings.push(parent)
      }
      siblings = parent.children!
    }

    const existing = siblings.find(
      (node) => node.path === item.path && node.page === false
    )
    if (existing) {
      Object.assign(existing, {
        ...item,
        page: undefined,
        children: [...(item.children ?? []), ...(existing.children ?? [])],
      })
    } else {
      siblings.push(item)
    }
  }

  return clearTree(nav)
}

/** Removes empty `children` and the `page: undefined` keys, like Nuxt Content does. */
function clearTree(nav: RuntimeNavItem[]): RuntimeNavItem[] {
  for (const item of nav) {
    if (item.page === undefined) {
      delete item.page
    }
    if (item.children?.length) {
      clearTree(item.children)
    } else {
      delete item.children
    }
  }
  return nav
}

/** The pages of a tree in reading order. A folder with no page is skipped. */
export function flattenNavigation(nav: RuntimeNavItem[]): RuntimeNavItem[] {
  return nav.flatMap((item) => {
    const children = item.children ? flattenNavigation(item.children) : []
    if (
      item.page === false ||
      children.some((child) => child.path === item.path)
    ) {
      return children
    }
    return [{ ...item, children: undefined }, ...children]
  })
}

/** The previous and the next page of `path`. A missing neighbor is `null`. An unknown path gives two `null`. */
export function surroundOf(
  nav: RuntimeNavItem[],
  path: string
): [RuntimeSurroundItem | null, RuntimeSurroundItem | null] {
  const flat = flattenNavigation(nav)
  const index = flat.findIndex((item) => item.path === path)
  const pick = (
    item: RuntimeNavItem | undefined
  ): RuntimeSurroundItem | null =>
    item
      ? {
          title: item.title,
          path: item.path,
          stem: item.stem,
          ...(item.description ? { description: item.description } : {}),
        }
      : null
  if (index === -1) {
    return [null, null]
  }
  return [pick(flat[index - 1]), pick(flat[index + 1])]
}

/** The content id of the page for a route path, or `undefined`. Ignores a trailing slash. */
export function pageIdForRoute(
  ids: string[],
  path: string,
  routePrefix = ''
): string | undefined {
  const wanted = path.length > 1 ? path.replace(/\/+$/, '') : path
  return ids.find((id) => contentRoutePath(id, routePrefix) === wanted)
}

/** One entry of the store listing: the id and the version (`_version`) of the file. */
export interface ListedVersion {
  id: string
  version?: string
}

/** The difference between the build manifest of a type and the store listing. */
export interface ManifestDiff {
  /** True when nothing differs: the build data is current. */
  same: boolean
  /** Ids in both, with another version. */
  changed: string[]
  /** Ids only in the store. */
  added: string[]
  /** Ids only in the manifest. */
  removed: string[]
}

/**
 * Compares the build manifest (id → version) with the store listing. A store entry without a
 * version counts as changed, because the build data cannot be proven current.
 */
export function diffManifest(
  manifest: Record<string, string> | undefined,
  current: ListedVersion[]
): ManifestDiff {
  const built = manifest ?? {}
  const seen = new Set<string>()
  const changed: string[] = []
  const added: string[] = []
  for (const entry of current) {
    seen.add(entry.id)
    if (!Object.hasOwn(built, entry.id)) {
      added.push(entry.id)
    } else if (!entry.version || built[entry.id] !== entry.version) {
      changed.push(entry.id)
    }
  }
  const removed = Object.keys(built).filter((id) => !seen.has(id))
  return {
    same: changed.length === 0 && added.length === 0 && removed.length === 0,
    changed,
    added,
    removed,
  }
}

/** The page fields that Nuxt Content builds itself. Frontmatter with these keys does not go to `meta`. */
const PAGE_FIELD_KEYS = new Set([
  'id',
  'stem',
  'extension',
  'path',
  'title',
  'description',
  'seo',
  'navigation',
  'body',
  'rawbody',
  'meta',
])

/** Flat keys that the docs type adds to the frontmatter for its form fields. They are not file keys. */
const FORM_ONLY_KEYS = new Set([
  'navigationTitle',
  'navigationIcon',
  'navigationHidden',
  'seoTitle',
  'seoDescription',
])

/**
 * The extra keys of a page from its whole frontmatter. Nuxt Content keeps the keys that the
 * collection schema declares at the top level of the page and puts the other keys in `meta`. The
 * server does not know the schema, so a key goes in both places: the page reads it the same way in
 * both modes. A key that is a page field (`title`, `seo`, ...) is left out: the page builds it.
 */
export function frontmatterExtras(
  frontmatter: Record<string, unknown> | undefined
): { top: Record<string, unknown>; meta: Record<string, unknown> } {
  const top: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(frontmatter ?? {})) {
    if (
      !PAGE_FIELD_KEYS.has(key) &&
      !FORM_ONLY_KEYS.has(key) &&
      key !== '__proto__'
    ) {
      top[key] = value
    }
  }
  return { top, meta: { ...top } }
}

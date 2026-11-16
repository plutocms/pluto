import type { BlockNode, MenuLink, Wxr, WxrPost } from './types'
import { slugify, slugOf } from './pages'
import { localUrl } from './values'

export interface SourceMenu {
  id: number
  slug: string
  name: string
  handle: string
  tree: MenuLink[]
  items: number
  unmapped: string[]
  main: boolean
}

export interface MenuPlan {
  menus: SourceMenu[]
  empty: string[]
  main?: {
    handle: string
    name: string
    reason: string
  }
}

const MAIN_WORDS = ['primary', 'main', 'header', 'menu-1']

const SKIPPED = new Set(['trash', 'auto-draft'])

interface Described {
  label: string
  link?: string
  target?: string
}

function byId(posts: WxrPost[], type: string): Map<number, WxrPost> {
  return new Map(
    posts.filter((post) => post.type === type).map((post) => [post.id, post])
  )
}

function countItems(tree: MenuLink[]): number {
  return tree.reduce((sum, item) => sum + 1 + countItems(item.children), 0)
}

function menuOf(item: WxrPost): string | undefined {
  return item.categories.find((entry) => entry.domain === 'nav_menu')?.slug
}

function describeItem(
  wxr: Wxr,
  item: WxrPost,
  paths: Map<number, string>,
  imported: Set<number>,
  unmapped: string[]
): Described {
  const type = item.meta._menu_item_type ?? ''
  const object = item.meta._menu_item_object ?? ''
  const objectId = Number(item.meta._menu_item_object_id) || 0
  const url = item.meta._menu_item_url?.trim() ?? ''
  const own = item.title.trim()
  const target = item.meta._menu_item_target === '_blank' ? '_blank' : undefined

  if (type === 'post_type' && object === 'page') {
    const page = byId(wxr.posts, 'page').get(objectId)
    const path = paths.get(objectId)

    if (!page || path === undefined) {
      unmapped.push(
        `"${own || `page ${objectId}`}": the page ${objectId} is not in the export, so the item has no link.`
      )

      return { label: own, target }
    }

    const link = path === 'home' ? '/' : `/${path}`

    if (!imported.has(page.id)) {
      unmapped.push(
        `"${own || page.title}": the page ${page.id} is in the export but was not imported (it is not built with Elementor). The link ${link} leads nowhere until you create the page.`
      )
    }

    return { label: own || page.title, link, target }
  }

  if (type === 'post_type' && object === 'post') {
    const post = byId(wxr.posts, 'post').get(objectId)

    unmapped.push(
      `"${own || post?.title || `post ${objectId}`}": the importer does not import posts. The link points to the post path of the blog template.`
    )

    return {
      label: own || post?.title || '',
      link: post ? `/posts/${slugOf(post)}` : undefined,
      target,
    }
  }

  if (type === 'custom') {
    return {
      label: own,
      link: !url || url === '#' ? undefined : localUrl(url, wxr.baseUrl),
      target,
    }
  }

  if (type === 'taxonomy') {
    const term = wxr.terms.find((entry) => entry.id === objectId)
    const label = own || term?.name || ''
    const link = url ? localUrl(url, wxr.baseUrl) : undefined

    unmapped.push(
      `"${label || `term ${objectId}`}": an archive of the taxonomy "${object || 'unknown'}". Pluto has no page for it. ${link ? `The URL stays: ${link}.` : 'The export has no URL, so the item has no link.'}`
    )

    return { label, link, target }
  }

  unmapped.push(
    `"${own || item.id}": an item of the type "${type || 'unknown'}"${object ? ` (${object})` : ''}. ${url ? `The URL stays: ${url}.` : 'It has no link.'}`
  )

  return {
    label: own,
    link: url ? localUrl(url, wxr.baseUrl) : undefined,
    target,
  }
}

function treeOf(
  wxr: Wxr,
  items: WxrPost[],
  paths: Map<number, string>,
  imported: Set<number>,
  unmapped: string[]
): MenuLink[] {
  const sorted = [...items].sort(
    (a, b) => a.menuOrder - b.menuOrder || a.id - b.id
  )
  const nodes = new Map<number, MenuLink>()

  for (const item of sorted) {
    const entry = describeItem(wxr, item, paths, imported, unmapped)

    if (entry.label) {
      nodes.set(item.id, { ...entry, children: [] })
    } else {
      unmapped.push(
        `Item ${item.id} has no title and no readable target. It was dropped.`
      )
    }
  }

  const parents = new Map(
    sorted.map((item) => [
      item.id,
      Number(item.meta._menu_item_menu_item_parent) || 0,
    ])
  )
  const root: MenuLink[] = []

  for (const item of sorted) {
    const node = nodes.get(item.id)

    if (!node) {
      continue
    }

    const seen = new Set<number>([item.id])
    let parent = parents.get(item.id) ?? 0

    while (parent && !nodes.has(parent) && parents.has(parent)) {
      if (seen.has(parent)) {
        parent = 0

        break
      }

      seen.add(parent)
      parent = parents.get(parent) ?? 0
    }

    const holder = parent && !seen.has(parent) ? nodes.get(parent) : undefined

    if (holder) {
      holder.children.push(node)
    } else {
      root.push(node)
    }
  }

  return root
}

function chooseMain(
  menus: SourceMenu[],
  headerMenu: string | undefined
): { menu: SourceMenu; reason: string } | undefined {
  for (const word of MAIN_WORDS) {
    const menu = menus.find((entry) =>
      `${entry.slug} ${entry.name}`.toLowerCase().includes(word)
    )

    if (menu) {
      return { menu, reason: `its name or slug contains "${word}"` }
    }
  }

  const header = menus.find(
    (menu) =>
      headerMenu !== undefined &&
      (menu.slug === headerMenu || menu.name === headerMenu)
  )

  if (header) {
    return { menu: header, reason: 'the header navigation widget uses it' }
  }

  const largest = [...menus].sort((a, b) => b.items - a.items)[0]

  return largest
    ? { menu: largest, reason: 'it is the largest menu' }
    : undefined
}

/**
 * Reads the menus of a WXR: the `nav_menu` terms and their `nav_menu_item` posts. A menu with no
 * item is left out. The primary menu gets the handle `main`.
 * @see https://developer.wordpress.org/themes/functionality/navigation-menus/
 */
export function readMenus(
  wxr: Wxr,
  paths: Map<number, string>,
  imported: Set<number>,
  headerMenu?: string
): MenuPlan {
  const items = wxr.posts.filter(
    (post) => post.type === 'nav_menu_item' && !SKIPPED.has(post.status)
  )
  const sources = wxr.terms
    .filter((term) => term.taxonomy === 'nav_menu')
    .map((term) => ({ id: term.id, slug: term.slug, name: term.name }))

  for (const item of items) {
    const slug = menuOf(item)

    if (slug && !sources.some((source) => source.slug === slug)) {
      const name = item.categories.find(
        (entry) => entry.domain === 'nav_menu'
      )!.name

      sources.push({ id: 0, slug, name })
    }
  }

  const menus: SourceMenu[] = sources.map((source) => {
    const unmapped: string[] = []
    const tree = treeOf(
      wxr,
      items.filter((item) => menuOf(item) === source.slug),
      paths,
      imported,
      unmapped
    )

    return {
      ...source,
      name: source.name || source.slug,
      handle: '',
      tree,
      items: countItems(tree),
      unmapped,
      main: false,
    }
  })
  const filled = menus.filter((menu) => menu.items > 0)
  const chosen = chooseMain(filled, headerMenu)
  const taken = new Set<string>(chosen ? ['main'] : [])

  if (chosen) {
    chosen.menu.handle = 'main'
    chosen.menu.main = true
  }

  for (const menu of filled) {
    if (menu.main) {
      continue
    }

    const base = slugify(menu.name) || slugify(menu.slug) || 'menu'
    let handle = base
    let index = 2

    while (taken.has(handle)) {
      handle = `${base}-${index++}`
    }

    taken.add(handle)
    menu.handle = handle
  }

  return {
    menus: filled,
    empty: menus.filter((menu) => menu.items === 0).map((menu) => menu.name),
    main: chosen && {
      handle: 'main',
      name: chosen.menu.name,
      reason: chosen.reason,
    },
  }
}

/** The `menu-item` blocks of a menu tree. */
export function menuNodes(tree: MenuLink[]): BlockNode[] {
  return tree.map((item) => ({
    name: 'menu-item',
    props: {
      label: item.label,
      link: item.link,
      target: item.target,
    },
    children: item.children.length > 0 ? menuNodes(item.children) : undefined,
  }))
}

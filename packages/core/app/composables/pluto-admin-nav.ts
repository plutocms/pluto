import type { NavGroupBucket } from './internal/nav-groups'
import { contentTypeNewPath } from '../../shared/utils/content-admin-paths'
import { contentTypeMatches } from './internal/admin-menu'
import { contentTextFor } from './internal/content-text'
import { findNavGroup, splitByNavGroup } from './internal/nav-groups'

// The id of core's Settings nav item (extension `pluto`, entry `settings`).
const SETTINGS_NAV_ID = 'pluto:settings'

/**
 * The admin sidebar nav. Merges two sources:
 *
 * 1. The registry's own `nav` bucket — a layer's own `definePlutoExtension`
 *    call.
 * 2. One synthesized entry per auto-routed content type (`type.autoRoutes
 *    !== false`) — a layer that declares a content type gets a nav entry
 *    for free, without calling `definePlutoExtension` itself. Gated on the
 *    same "no capability declared = always visible" rule the generic
 *    content routes already use server-side (see the content-model skill):
 *    when `type.capabilities.read` is unset, the entry is always visible;
 *    when it is set, `can(...)` decides.
 *
 * Labels are key-or-literal. They resolve with `tx()`. A content type's
 * labels come from `usePlutoContentText`, so the convention keys apply. The
 * `computed` reads the active locale, so a locale switch updates the labels.
 *
 * A content type that names a group (`type.navGroup`, see the `navGroups`
 * bucket) joins the group item when the group has two or more visible types.
 * The item has the label and the icon of the group, and one child per type
 * (its plural label, linked to its list page). It is active on the pages of its
 * types. A group with one visible type shows that type as a normal item.
 *
 * The Settings item (`pluto:settings`) gets one child per visible settings page
 * (`usePlutoSettingsPages`) when there are two or more. It opens by default
 * on `/admin/settings/**`.
 *
 * `entry.enabled` is read and enforced uniformly across both sources
 * here. Source 1 already filters on it a second time, inside
 * `createOwnedRegistry` itself (see
 * `app/composables/internal/registry-factory.ts`) — applying the same
 * filter again here is harmless for that source, and is what makes source
 * 2 (plain objects that never pass through that registry) respect
 * `enabled` too, instead of only source 1.
 */
export function usePlutoAdminNav() {
  const registry = usePlutoRegistry()
  const { items: contentTypes } = usePlutoContentTypes()
  const navGroups = registry.navGroups.list
  const { can } = usePlutoPermissions()
  const { items: settingsPages, current: currentSettingsPage } =
    usePlutoSettingsPages()
  const i18n = usePlutoI18n()
  const { t, tx } = i18n

  // Dev only. The groups already warned about, so each warns once.
  const warnedGroups = new Set<string>()

  const items = computed<PlutoNavItem[]>(() => {
    const registered = registry.nav.list.value
    // A child with `enabled` shows only when the test passes (for example a
    // child for admins only). An item with its own `to` and one visible child
    // stays a plain link, like Settings with one page.
    const resolveLabels = (item: PlutoNavItem): PlutoNavItem => {
      const children = item.children
        ?.filter((child) => child.enabled?.() ?? true)
        .map((child) => ({
          ...child,
          label: tx(child.label),
        }))
      return {
        ...item,
        label: tx(item.label),
        children:
          item.to && children && children.length < 2 ? undefined : children,
      }
    }

    const isVisible = (type: PlutoContentType): boolean =>
      !type.capabilities?.read || can(type.capabilities.read)

    // The "+" of the sidebar: the new page of a type the user may write.
    const canWrite = (type: PlutoContentType): boolean =>
      !type.capabilities?.write || can(type.capabilities.write)
    const newLink = (type: PlutoContentType) =>
      canWrite(type)
        ? {
            newTo: contentTypeNewPath(type),
            newLabel: contentTextFor(type, i18n).newLabel,
          }
        : {}

    function typeNav(type: PlutoContentType): PlutoNavItem {
      const text = contentTextFor(type, i18n)
      const basePath = type.basePath ?? `/admin/content/${type.name}`

      return {
        id: `content:${type.name}`,
        order: type.navOrder ?? 100,
        label: text.labelPlural,
        icon: type.icon,
        to: basePath,
        ...newLink(type),
        enabled: () => isVisible(type),
        children: [
          {
            label: t('pluto.content.all', { labelPlural: text.labelPlural }),
            to: basePath,
          },
          {
            label: t('pluto.content.createNew', { label: text.label }),
            to: `${basePath}/new`,
          },
        ],
      }
    }

    // One item for the visible types of a group. A child is the list page of a
    // type. The `match` paths keep the item active on the new and edit pages.
    function groupNav(bucket: NavGroupBucket<PlutoContentTypeEntry>) {
      const types = bucket.items.map((entry) => entry.type)
      const basePathOf = (type: PlutoContentType) =>
        type.basePath ?? `/admin/content/${type.name}`
      return {
        id: `group:${bucket.group.id}`,
        order: bucket.group.order ?? 100,
        label: tx(bucket.group.label),
        icon: bucket.group.icon,
        children: types.map((type) => ({
          label: contentTextFor(type, i18n).labelPlural,
          to: basePathOf(type),
          icon: type.icon,
          ...newLink(type),
        })),
        match: types.flatMap((type) =>
          [type.newPath, type.editPath?.('').replace(/\/+$/, '')].filter(
            (path): path is string => Boolean(path)
          )
        ),
      } satisfies PlutoNavItem
    }

    const autoRouted = contentTypes.value.filter(
      (entry) => entry.type.autoRoutes !== false && isVisible(entry.type)
    )
    const { ungrouped, grouped } = splitByNavGroup(autoRouted, navGroups.value)
    for (const entry of autoRouted) {
      const name = entry.type.navGroup
      if (
        import.meta.dev &&
        name &&
        !findNavGroup(navGroups.value, name) &&
        !warnedGroups.has(name)
      ) {
        warnedGroups.add(name)
        console.warn(
          `[pluto] The content type "${entry.type.name}" names the nav group "${name}", but no extension declares it.`
        )
      }
    }

    // A group with one visible type shows that type as a normal item.
    const contentNav: PlutoNavItem[] = [
      ...ungrouped.map((entry) => typeNav(entry.type)),
      ...grouped.flatMap((bucket) =>
        bucket.items.length >= 2
          ? [groupNav(bucket)]
          : bucket.items.map((entry) => typeNav(entry.type))
      ),
    ]

    // The Settings item lists one child per visible settings page, when there
    // are two or more. With one page (General), the item stays a plain link.
    const withSettingsChildren = (item: PlutoNavItem): PlutoNavItem =>
      item.id === SETTINGS_NAV_ID && settingsPages.value.length >= 2
        ? {
            ...item,
            defaultOpen: currentSettingsPage.value !== undefined,
            children: settingsPages.value.map((page) => ({
              label: page.label,
              to: page.to,
              icon: page.icon,
            })),
          }
        : item

    // A registered item at the `basePath` of a content type also owns the
    // type's new and edit pages, so the sidebar opens it there.
    const withTypeMatches = (item: PlutoNavItem): PlutoNavItem => {
      const extra = contentTypeMatches(
        item,
        contentTypes.value.map((entry) => entry.type)
      )
      return extra.length > 0
        ? { ...item, match: [...(item.match ?? []), ...extra] }
        : item
    }

    return [
      ...registered
        .map(resolveLabels)
        .map(withSettingsChildren)
        .map(withTypeMatches),
      ...contentNav,
    ]
      .filter((item) => item.enabled?.() ?? true)
      .sort((a, b) => (a.order ?? 100) - (b.order ?? 100))
  })

  return { items }
}

/** One tab of the section of the current page. See usePlutoAdminNavTabs. */
export interface PlutoAdminNavTab {
  label: string
  icon?: string
  to: string
  active: boolean
}

/** The "new" link of a section: a button at the end of its tabs. */
export interface PlutoAdminNavAction {
  label: string
  to: string
}

// Trailing slashes off, so `/admin/users/` matches `/admin/users`.
function trimPath(path: string): string {
  return path.replace(/\/+$/, '') || '/'
}

/**
 * The tabs of the section of the current page: the children of the menu item
 * whose submenu holds the page. Settings, the Users item of a backend layer and
 * a group of content types (Pages) all get them.
 *
 * - A child matches the path exactly, or as a prefix (`/admin/users` matches
 *   `/admin/users/5`). The longest match wins, so General (`/admin/settings`)
 *   is not active on `/admin/settings/email`.
 * - A "new" child (its `to` is the `newTo` of the item, or ends with `/new`)
 *   is not a tab: it is `action`, a button at the end of the tabs.
 * - The tabs show only with two or more of them. A section of one list and its
 *   "new" page (a content type: All posts, New post) shows none: the list page
 *   has its own New button.
 *
 * `label` is the label of the section (for `aria-label`). A page shows the
 * tabs with `PlutoAdminNavTabs`.
 */
export function usePlutoAdminNavTabs() {
  const { items } = usePlutoAdminNav()
  const route = useRoute()

  const isNewChild = (item: PlutoNavItem, child: PlutoNavChild): boolean =>
    (item.newTo !== undefined && trimPath(child.to) === trimPath(item.newTo)) ||
    trimPath(child.to).endsWith('/new')

  const section = computed(() => {
    const path = trimPath(route.path)
    let best: { item: PlutoNavItem; to: string } | undefined
    for (const item of items.value) {
      const pages = (item.children ?? []).filter(
        (child) => !isNewChild(item, child)
      )
      if (pages.length < 2) {
        continue
      }
      for (const child of pages) {
        const to = trimPath(child.to)
        const matches = path === to || path.startsWith(`${to}/`)
        if (matches && (!best || to.length > best.to.length)) {
          best = { item, to }
        }
      }
    }
    return best
  })

  const tabs = computed<PlutoAdminNavTab[]>(() => {
    const current = section.value
    if (!current) {
      return []
    }
    return (current.item.children ?? [])
      .filter((child) => !isNewChild(current.item, child))
      .map((child) => ({
        label: child.label,
        icon: child.icon,
        to: child.to,
        active: trimPath(child.to) === current.to,
      }))
  })

  const action = computed<PlutoAdminNavAction | undefined>(() => {
    const item = section.value?.item
    const child = item?.children?.find((entry) => isNewChild(item, entry))
    return child ? { label: child.label, to: child.to } : undefined
  })

  return {
    tabs,
    action,
    label: computed(() => section.value?.item.label ?? ''),
  }
}

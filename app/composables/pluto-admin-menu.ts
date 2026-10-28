import type { NavigationMenuItem } from '@nuxt/ui'
import { nextOpenGroups } from './internal/admin-menu'

// `to` is typed per-app via Nuxt's typed pages, so it differs across every
// app that extends this layer. This menu only ever uses `href`, so drop `to`
// here to avoid a cross-app type mismatch on that field.
export type PlutoAdminMenuItem = Omit<NavigationMenuItem, 'to'>

function toMenuItem(item: PlutoNavItem): PlutoAdminMenuItem {
  return {
    // The value names the item in the open groups (usePlutoAdminMenuGroups).
    value: item.id,
    label: item.label,
    icon: item.icon,
    href: item.to,
    // Top-level items SPA-navigate instead of doing a full page load.
    // Children stay href-only.
    onSelect: item.to ? () => navigateTo(item.to) : undefined,
    children: item.children?.map((child) => ({
      label: child.label,
      href: child.to,
      // A child that points at its parent's own path (Settings > General)
      // must not stay active on the sibling pages below that path.
      exact: child.to === item.to ? true : undefined,
    })),
  }
}

/**
 * The admin navigation as `UNavigationMenu` items. The admin layout's
 * sidebar and the public-page admin menu (`PlutoNavbarAdminMenu`) both
 * use it, so they always show the same items.
 */
export function usePlutoAdminMenu() {
  const { items } = usePlutoAdminNav()
  return computed<PlutoAdminMenuItem[]>(() => items.value.map(toMenuItem))
}

/**
 * The ids of the open groups of the admin menu, for the `v-model` of
 * `UNavigationMenu`. The sidebar and the public-page menu share it. The
 * group of the active page opens after each navigation, and a group with
 * `defaultOpen` opens when it first shows. The user can close any group.
 */
export function usePlutoAdminMenuGroups() {
  const route = useRoute()
  const { items } = usePlutoAdminNav()
  const open = useState<string[]>('pluto-admin-menu-groups', () => [])
  const known = useState<string[]>('pluto-admin-menu-known', () => [])

  function update(navigated: boolean) {
    open.value = nextOpenGroups(open.value, items.value, route.path, new Set(known.value), navigated)
    known.value = items.value.map((item) => item.id)
  }

  update(false)
  watch(() => route.path, () => update(true))
  watch(() => items.value.map((item) => item.id).join(','), () => update(false))

  return open
}

/**
 * Whether the admin menu is open on a small screen. This key is a
 * cross-repo contract: the `supabase` layer's navbar
 * (`app/components/navbar/NavbarAdmin.vue`) writes to this exact state key
 * from its menu button. Keep the name as it is.
 */
export function usePlutoAdminMenuOpen() {
  return useState<boolean>('pluto-admin-sidebar-open', () => false)
}

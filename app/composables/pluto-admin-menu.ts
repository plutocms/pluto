import type { NavigationMenuItem } from '@nuxt/ui'

// `to` is typed per-app via Nuxt's typed pages, so it differs across every
// app that extends this layer. This menu only ever uses `href`, so drop `to`
// here to avoid a cross-app type mismatch on that field.
export type PlutoAdminMenuItem = Omit<NavigationMenuItem, 'to'>

function toMenuItem(item: PlutoNavItem): PlutoAdminMenuItem {
  return {
    label: item.label,
    icon: item.icon,
    href: item.to,
    // Top-level items SPA-navigate instead of doing a full page load.
    // Children stay href-only.
    onSelect: item.to ? () => navigateTo(item.to) : undefined,
    defaultOpen: item.defaultOpen,
    children: item.children?.map((child) => ({
      label: child.label,
      href: child.to,
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
 * Whether the admin menu is open on a small screen. This key is a
 * cross-repo contract: the `supabase` layer's navbar
 * (`app/components/navbar/NavbarAdmin.vue`) writes to this exact state key
 * from its menu button. Keep the name as it is.
 */
export function usePlutoAdminMenuOpen() {
  return useState<boolean>('pluto-admin-sidebar-open', () => false)
}

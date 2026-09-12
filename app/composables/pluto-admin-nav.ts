// The old `NavigationMenuItem`/`NavigationMenuChildItem` shape (from
// `@plutocms/utils`) always carries a plain `href`, never Nuxt's typed `to`.
// This narrows just the field the bridge below reads.
interface LegacyHrefLink {
  href?: string
}

/**
 * The admin sidebar nav. Merges the new registry with the old
 * `useSidebarAdminActions` composable (`@plutocms/utils`), so an unmigrated
 * layer's sidebar entries keep showing up. A bridged entry is skipped when a
 * registered entry already uses the same label, so a layer that migrates
 * does not get a duplicate item.
 */
export function usePlutoAdminNav() {
  const registry = usePlutoRegistry()
  const legacy = useSidebarAdminActions()

  const items = computed<PlutoNavItem[]>(() => {
    const registered = registry.nav.list.value
    const seen = new Set(registered.map((item) => item.label))

    const bridged = legacy.actions.value
      .filter((action) => !seen.has(String(action.label)))
      .map((action, index) => ({
        id: `legacy:sidebar-${index}`,
        order: 500,
        label: String(action.label ?? ''),
        icon: action.icon,
        to: (action as LegacyHrefLink).href,
        defaultOpen: action.defaultOpen,
        children: (action.children ?? []).map((child) => ({
          label: String(child.label ?? ''),
          to: (child as LegacyHrefLink).href ?? '',
        })),
      }))

    return [...registered, ...bridged].sort(
      (a, b) => (a.order ?? 100) - (b.order ?? 100)
    )
  })

  return { items }
}

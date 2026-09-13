// The old `NavigationMenuItem`/`NavigationMenuChildItem` shape (from
// `@plutocms/utils`) always carries a plain `href`, never Nuxt's typed `to`.
// This narrows just the field the bridge below reads.
interface LegacyHrefLink {
  href?: string
}

/**
 * The admin sidebar nav. Merges three sources:
 *
 * 1. The registry's own `nav` bucket — a layer's own `definePlutoExtension`
 *    call.
 * 2. The old `useSidebarAdminActions` composable (`@plutocms/utils`), so an
 *    unmigrated layer's sidebar entries keep showing up. A bridged entry is
 *    skipped when a registered entry already uses the same label, so a
 *    layer that migrates does not get a duplicate item.
 * 3. One synthesized entry per auto-routed content type (`type.autoRoutes
 *    !== false`) — a layer that declares a content type gets a nav entry
 *    for free, without calling `definePlutoExtension` itself. Gated on the
 *    same "no capability declared = always visible" rule the generic
 *    content routes already use server-side (see the content-model skill):
 *    when `type.capabilities.read` is unset, the entry is always visible;
 *    when it is set, `can(...)` decides.
 *
 * `entry.enabled` is read and enforced uniformly across all three sources
 * here. Source 1 already filters on it a second time, inside
 * `createOwnedRegistry` itself (see
 * `app/composables/internal/registry-factory.ts`) — applying the same
 * filter again here is harmless for that source, and is what makes sources
 * 2 and 3 (plain objects that never pass through that registry) respect
 * `enabled` too, instead of only source 1.
 */
export function usePlutoAdminNav() {
  const registry = usePlutoRegistry()
  const legacy = useSidebarAdminActions()
  const { items: contentTypes } = usePlutoContentTypes()
  const { can } = usePlutoPermissions()

  const items = computed<PlutoNavItem[]>(() => {
    const registered = registry.nav.list.value
    const seen = new Set(registered.map((item) => item.label))

    const bridged: PlutoNavItem[] = legacy.actions.value
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

    const contentNav: PlutoNavItem[] = contentTypes.value
      .filter((entry) => entry.type.autoRoutes !== false)
      .map((entry) => {
        const type = entry.type
        const basePath = type.basePath ?? `/admin/content/${type.name}`

        return {
          id: `content:${type.name}`,
          order: type.navOrder ?? 100,
          label: type.labelPlural,
          icon: type.icon,
          to: basePath,
          enabled: () => !type.capabilities?.read || can(type.capabilities.read),
          children: [
            { label: `All ${type.labelPlural}`, to: basePath },
            { label: `Create new ${type.label}`, to: `${basePath}/new` },
          ],
        }
      })

    return [...registered, ...bridged, ...contentNav]
      .filter((item) => item.enabled?.() ?? true)
      .sort((a, b) => (a.order ?? 100) - (b.order ?? 100))
  })

  return { items }
}

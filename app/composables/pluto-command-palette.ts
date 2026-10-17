import type { CommandPaletteGroup, CommandPaletteItem } from '@nuxt/ui'

/**
 * Builds the admin command palette groups (`UDashboardSearch` in the
 * admin layout, opened with Cmd/Ctrl+K):
 *
 * - "Create": one "New <label>" command for each content type the user
 *   can write.
 * - "Go to": every admin nav item and nav child, from `usePlutoAdminNav`.
 *
 * Each destination shows once. A nav link to a create path (for example
 * "Create new post") is dropped, because the "Create" group has it.
 *
 * Commands navigate with `navigateTo` in `onSelect`, not with `to`. `to`
 * is typed per app through typed pages, so it differs in every app that
 * extends this layer. The admin layout's sidebar uses the same approach.
 */
export function usePlutoCommandPalette() {
  const { items: navItems } = usePlutoAdminNav()
  const { items: contentTypes } = usePlutoContentTypes()
  const { can } = usePlutoPermissions()

  return computed<CommandPaletteGroup<CommandPaletteItem>[]>(() => {
    const seen = new Set<string>()

    function command(label: string, path: string, extra: Partial<CommandPaletteItem> = {}): CommandPaletteItem[] {
      if (seen.has(path)) {
        return []
      }
      seen.add(path)
      return [{ label, ...extra, onSelect: () => navigateTo(path) }]
    }

    const create = contentTypes.value.flatMap(({ type }) => {
      // "No capability declared" means the operation is open to anyone who
      // can reach the admin, the same rule as PlutoContentForm.
      if (type.capabilities?.write && !can(type.capabilities.write)) {
        return []
      }
      const basePath = type.basePath ?? `/admin/content/${type.name}`
      return command(`New ${type.label}`, type.newPath ?? `${basePath}/new`, {
        icon: 'lucide:plus',
        suffix: type.labelPlural,
      })
    })

    const goTo = navItems.value.flatMap((item) => [
      ...(item.to ? command(item.label, item.to, { icon: item.icon }) : []),
      ...(item.children ?? []).flatMap((child) =>
        child.to ? command(child.label, child.to, { icon: item.icon, suffix: item.label }) : []
      ),
    ])

    return [
      { id: 'pluto-create', label: 'Create', items: create },
      { id: 'pluto-go-to', label: 'Go to', items: goTo },
    ].filter((group) => group.items.length > 0)
  })
}

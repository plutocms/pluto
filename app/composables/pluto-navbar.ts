/**
 * The admin navbar shell (the whole top bar, provided by a backend layer).
 * Reads the new registry and falls back to the old `useNavbarAdmin`
 * composable (`@plutocms/utils`) when no layer has migrated yet. The legacy
 * ref is read inside this `computed`, not once at setup, so a navbar
 * registered after this composable first runs is never lost.
 */
export function usePlutoNavbarShell() {
  const registry = usePlutoRegistry()
  const legacy = useNavbarAdmin()

  const component = computed<Component | null>(() => {
    const registered = registry.navbarShell.list.value
    const winner = registered.at(-1) // highest-order wins; ties go to most recent
    return winner?.component ?? legacy.navbar.value ?? null
  })

  return { component }
}

/**
 * The small action buttons rendered inside the navbar. Merges the new
 * registry with the old `useNavbarAdminActions` composable
 * (`@plutocms/utils`), so an unmigrated layer's actions keep showing up.
 */
export function usePlutoNavbarActions() {
  const registry = usePlutoRegistry()
  const legacy = useNavbarAdminActions()

  const items = computed<PlutoNavbarAction[]>(() => [
    ...registry.navbarActions.list.value,
    ...legacy.actions.value.map((component, index) => ({
      id: `legacy:navbar-action-${index}`,
      order: 500,
      component,
    })),
  ])

  return { items }
}

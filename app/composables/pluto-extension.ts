/**
 * The one function a layer author calls to plug into the admin UI. Every
 * bucket gets set for this extension's id on every call, so a layer's whole
 * admin-UI contribution lives in one place.
 *
 * Call this from a plugin (`app/plugins/*.ts`). Calling it again with the
 * same `id` replaces that layer's whole contribution — it does not add to
 * it — so re-running the plugin (for example on HMR) never duplicates
 * entries.
 */
export function definePlutoExtension(definition: PlutoExtension): void {
  const registry = usePlutoRegistry()

  registry.navbarShell.set(definition.id, definition.navbar ? [definition.navbar] : [])
  registry.navbarActions.set(definition.id, definition.navbarActions ?? [])
  registry.nav.set(definition.id, definition.nav ?? [])
  registry.pages.set(definition.id, definition.pages ?? [])
  registry.settingsPanels.set(definition.id, definition.settingsPanels ?? [])
  registry.settingsDrivers.set(
    definition.id,
    definition.settingsDriver ? [definition.settingsDriver] : []
  )
  registry.dashboardWidgets.set(definition.id, definition.dashboardWidgets ?? [])
}

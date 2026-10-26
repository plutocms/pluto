import { findSyncComponents } from './internal/async-component'

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

  if (import.meta.dev) {
    warnSyncComponents(definition)
  }

  registry.navbarShell.set(definition.id, definition.navbar ? [definition.navbar] : [])
  registry.navbarActions.set(definition.id, definition.navbarActions ?? [])
  registry.nav.set(definition.id, definition.nav ?? [])
  registry.pages.set(definition.id, definition.pages ?? [])
  registry.settingsPanels.set(definition.id, definition.settingsPanels ?? [])
  registry.settingsPages.set(definition.id, definition.settingsPages ?? [])
  registry.mailPanels.set(definition.id, definition.mailPanels ?? [])
  registry.settingsDrivers.set(
    definition.id,
    definition.settingsDriver ? [definition.settingsDriver] : []
  )
  registry.localeDrivers.set(
    definition.id,
    definition.localeDriver ? [definition.localeDriver] : []
  )
  registry.dashboardWidgets.set(definition.id, definition.dashboardWidgets ?? [])
  registry.capabilities.set(definition.id, definition.capabilities ?? [])
  registry.permissionsDrivers.set(
    definition.id,
    definition.permissionsDriver ? [definition.permissionsDriver] : []
  )
  registry.authDrivers.set(definition.id, definition.authDriver ? [definition.authDriver] : [])
  registry.accountMenu.set(definition.id, definition.accountMenu ?? [])
  registry.adminBanners.set(definition.id, definition.adminBanners ?? [])
  registry.siteInfo.set(definition.id, definition.site ? [definition.site] : [])
  registry.contentTypes.set(definition.id, definition.contentTypes ?? [])
  registry.contentFieldWidgets.set(definition.id, definition.contentFieldWidgets ?? [])
  registry.contentActions.set(definition.id, definition.contentActions ?? [])
  registry.contentToolbarItems.set(definition.id, definition.contentToolbarItems ?? [])
  registry.mediaAdapters.set(definition.id, definition.mediaAdapters ?? [])
}

// Dev only. The names already warned about, so each component warns once
// (the plugin runs again on HMR).
const warnedComponents = new Set<string>()

function warnSyncComponents(definition: PlutoExtension): void {
  for (const name of findSyncComponents(definition)) {
    if (warnedComponents.has(name)) {
      continue
    }
    warnedComponents.add(name)
    console.warn(
      `[pluto] ${name} is not an async component. Register it with defineAsyncComponent(() => import('...')) so it loads on demand and core shows a skeleton.`
    )
  }
}

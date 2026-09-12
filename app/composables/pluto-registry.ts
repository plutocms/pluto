import { createOwnedRegistry } from './internal/registry-factory'

/**
 * The one registry container for this Nuxt app instance. Created lazily on
 * `nuxtApp`, not at module scope, so it is per-request on the server and
 * per-app on the client — never a process-wide singleton, and never
 * serialized into the SSR payload.
 *
 * No plugin-ordering contract is needed: a layer's plugin can call this
 * before or after any other layer's plugin.
 */
export function usePlutoRegistry(): PlutoRegistry {
  const nuxtApp = useNuxtApp()

  if (!nuxtApp._plutoRegistry) {
    nuxtApp._plutoRegistry = {
      navbarShell: createOwnedRegistry<PlutoNavbarShell>(),
      navbarActions: createOwnedRegistry<PlutoNavbarAction>(),
      nav: createOwnedRegistry<PlutoNavItem>(),
      pages: createOwnedRegistry<PlutoAdminPage>(),
      settingsPanels: createOwnedRegistry<PlutoSettingsPanel>(),
      settingsDrivers: createOwnedRegistry<PlutoSettingsDriver>(),
      dashboardWidgets: createOwnedRegistry<PlutoDashboardWidget>(),
      capabilities: createOwnedRegistry<PlutoCapability>(),
      permissionsDrivers: createOwnedRegistry<PlutoPermissionsDriver>(),
      contentTypes: createOwnedRegistry<PlutoContentTypeEntry>(),
      contentFieldWidgets: createOwnedRegistry<PlutoContentFieldWidget>(),
      mediaAdapters: createOwnedRegistry<PlutoMediaAdapterEntry>(),
    }
  }

  // Cast rather than rely on control-flow narrowing of a global-augmented
  // property: that narrowing is fragile across vue-tsc's separate project
  // references (app/server/shared), and has been observed to resolve to
  // `unknown` instead of `PlutoRegistry` in some of them.
  return nuxtApp._plutoRegistry as PlutoRegistry
}

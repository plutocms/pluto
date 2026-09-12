import type { Component, ComputedRef } from 'vue'

export interface PlutoEntry {
  /** Unique inside this extension. Stored as `<extensionId>:<id>`. */
  id: string
  /** Lower comes first. Default 100. Core uses 0 for Home and 1000 for Settings. */
  order?: number
  /** Reactive visibility test. Called inside a computed. */
  enabled?: () => boolean
}

export interface PlutoNavChild {
  label: string
  to: string
}

export interface PlutoNavItem extends PlutoEntry {
  label: string
  icon?: string
  /** Admin route path, for example '/admin/posts'. Plain string on purpose. */
  to?: string
  children?: PlutoNavChild[]
  defaultOpen?: boolean
}

export interface PlutoNavbarShell extends PlutoEntry {
  component: Component
}

export interface PlutoNavbarAction extends PlutoEntry {
  component: Component
}

export interface PlutoAdminPage extends PlutoEntry {
  /** The route Nuxt already created from a file. This registry only adds metadata. */
  path: string
  title: string
  icon?: string
  /** Full id of a parent page (e.g. 'supabase-blog:posts'), for a breadcrumb trail. */
  parent?: string
}

export interface PlutoDashboardWidget extends PlutoEntry {
  component: Component
  title?: string
  /** Grid columns on large screens. 1 to 3. Default 1. */
  colSpan?: 1 | 2 | 3
}

export interface PlutoSettingsPanel extends PlutoEntry {
  title: string
  description?: string
  icon?: string
  component: Component
}

export interface PlutoSettingsDriver extends PlutoEntry {
  load: () => Promise<Record<string, string>>
  save: (patch: Record<string, string>) => Promise<void>
}

export interface PlutoExtension {
  /** Layer name. Use the package's $meta.name, e.g. 'supabase-blog'. */
  id: string
  navbar?: PlutoNavbarShell
  navbarActions?: PlutoNavbarAction[]
  nav?: PlutoNavItem[]
  pages?: PlutoAdminPage[]
  dashboardWidgets?: PlutoDashboardWidget[]
  settingsPanels?: PlutoSettingsPanel[]
  settingsDriver?: PlutoSettingsDriver
}

/**
 * The shape `createOwnedRegistry` returns, one per registrable thing. Declared
 * again here, rather than imported from `app/composables/internal`, because
 * the shared TS project does not include `app/`. Structural typing keeps this
 * in sync with the real return type.
 */
export interface PlutoRegistryBucket<T extends PlutoEntry> {
  set: (owner: string, entries: T[]) => void
  remove: (owner: string) => void
  list: ComputedRef<T[]>
}

export interface PlutoRegistry {
  navbarShell: PlutoRegistryBucket<PlutoNavbarShell>
  navbarActions: PlutoRegistryBucket<PlutoNavbarAction>
  nav: PlutoRegistryBucket<PlutoNavItem>
  pages: PlutoRegistryBucket<PlutoAdminPage>
  settingsPanels: PlutoRegistryBucket<PlutoSettingsPanel>
  settingsDrivers: PlutoRegistryBucket<PlutoSettingsDriver>
  dashboardWidgets: PlutoRegistryBucket<PlutoDashboardWidget>
}

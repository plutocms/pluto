import type { Component } from 'vue'

/**
 * True when `component` came from `defineAsyncComponent`. Vue marks that
 * wrapper with `__asyncLoader`.
 */
export function isAsyncComponent(component: unknown): boolean {
  return (
    typeof component === 'object' &&
    component !== null &&
    typeof (component as {
 __asyncLoader?: unknown
}).__asyncLoader === 'function'
  )
}

interface ExtensionComponents {
  id: string
  contentFieldWidgets?: {
 id: string
component: Component
}[]
  dashboardWidgets?: {
 id: string
component: Component
}[]
  settingsPanels?: {
 id: string
component: Component
}[]
  mailPanels?: {
 id: string
component: Component
}[]
  contentToolbarItems?: {
 id: string
component: Component
}[]
  adminBanners?: {
 id: string
component: Component
}[]
}

/**
 * Lists the registered components of an extension that are not async, as
 * `<extension id>:<bucket>:<entry id>`. The navbar actions are not checked:
 * the navbar must be ready at the first paint.
 */
export function findSyncComponents(definition: ExtensionComponents): string[] {
  const buckets = ['contentFieldWidgets', 'dashboardWidgets', 'settingsPanels', 'mailPanels', 'adminBanners', 'contentToolbarItems'] as const
  const found: string[] = []

  for (const bucket of buckets) {
    for (const entry of definition[bucket] ?? []) {
      if (!isAsyncComponent(entry.component)) {
        found.push(`${definition.id}:${bucket}:${entry.id}`)
      }
    }
  }

  return found
}

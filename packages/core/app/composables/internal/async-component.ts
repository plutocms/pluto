import type { Component } from 'vue'

export function isAsyncComponent(component: unknown): boolean {
  return (
    typeof component === 'object' &&
    component !== null &&
    typeof (
      component as {
        __asyncLoader?: unknown
      }
    ).__asyncLoader === 'function'
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
  backend?: {
    id: string
    details?: Component
  }
}

export function findSyncComponents(definition: ExtensionComponents): string[] {
  const buckets = [
    'contentFieldWidgets',
    'dashboardWidgets',
    'settingsPanels',
    'mailPanels',
    'adminBanners',
    'contentToolbarItems',
  ] as const
  const found: string[] = []

  for (const bucket of buckets) {
    for (const entry of definition[bucket] ?? []) {
      if (!isAsyncComponent(entry.component)) {
        found.push(`${definition.id}:${bucket}:${entry.id}`)
      }
    }
  }

  const details = definition.backend?.details
  if (details && !isAsyncComponent(details)) {
    found.push(`${definition.id}:backend:${definition.backend!.id}`)
  }

  return found
}

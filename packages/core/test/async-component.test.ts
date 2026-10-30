import { describe, expect, it } from 'vitest'
import { defineAsyncComponent, defineComponent } from 'vue'
import {
  findSyncComponents,
  isAsyncComponent,
} from '../app/composables/internal/async-component'

const syncComponent = defineComponent({ render: () => null })
const asyncComponent = defineAsyncComponent(() =>
  Promise.resolve(syncComponent)
)

describe('isAsyncComponent', () => {
  it('detects a component made by defineAsyncComponent', () => {
    expect(isAsyncComponent(asyncComponent)).toBe(true)
  })

  it('rejects a normal component, a function and a missing value', () => {
    expect(isAsyncComponent(syncComponent)).toBe(false)
    expect(isAsyncComponent(() => null)).toBe(false)
    expect(isAsyncComponent(undefined)).toBe(false)
    expect(isAsyncComponent(null)).toBe(false)
  })
})

describe('findSyncComponents', () => {
  it('lists only the entries that are not async, with their bucket', () => {
    const found = findSyncComponents({
      id: 'layer',
      contentFieldWidgets: [
        { id: 'a', component: asyncComponent },
        { id: 'b', component: syncComponent },
      ],
      dashboardWidgets: [{ id: 'c', component: syncComponent }],
      settingsPanels: [{ id: 'd', component: asyncComponent }],
      mailPanels: [{ id: 'm', component: syncComponent }],
      adminBanners: [{ id: 'e', component: syncComponent }],
    })

    expect(found).toEqual([
      'layer:contentFieldWidgets:b',
      'layer:dashboardWidgets:c',
      'layer:mailPanels:m',
      'layer:adminBanners:e',
    ])
  })

  it('returns an empty list when the extension has no component bucket', () => {
    expect(findSyncComponents({ id: 'layer' })).toEqual([])
  })
})

import type { OwnedEntry } from '../app/composables/internal/registry-factory'
import { describe, expect, it } from 'vitest'
import { ref } from 'vue'
import { createOwnedRegistry } from '../app/composables/internal/registry-factory'

interface TestEntry extends OwnedEntry {
  label: string
}

describe('createOwnedRegistry', () => {
  it('merges two owners entries and sorts them by order', () => {
    const registry = createOwnedRegistry<TestEntry>()

    registry.set('owner-a', [{ id: 'b', order: 50, label: 'B' }])
    registry.set('owner-b', [{ id: 'a', order: 10, label: 'A' }])

    expect(registry.list.value.map((entry) => entry.id)).toEqual([
      'owner-b:a',
      'owner-a:b',
    ])
  })

  it('keeps first-registration order for equal-order entries', () => {
    const registry = createOwnedRegistry<TestEntry>()

    registry.set('owner-a', [{ id: 'first', label: 'First' }])
    registry.set('owner-b', [{ id: 'second', label: 'Second' }])

    expect(registry.list.value.map((entry) => entry.id)).toEqual([
      'owner-a:first',
      'owner-b:second',
    ])
  })

  it('replaces an owner contribution instead of appending to it', () => {
    const registry = createOwnedRegistry<TestEntry>()

    registry.set('owner-a', [{ id: 'one', label: 'One' }])
    registry.set('owner-a', [{ id: 'one', label: 'One (updated)' }])

    expect(registry.list.value).toHaveLength(1)
    expect(registry.list.value[0]?.label).toBe('One (updated)')
  })

  it('filters out an entry whose enabled callback returns false, and reacts when it later returns true', () => {
    const registry = createOwnedRegistry<TestEntry>()
    // A real Vue ref, not a plain variable: `enabled` runs inside the
    // registry's `computed`, so reading `.value` here registers it as a
    // reactive dependency of `list`.
    const visible = ref(false)

    registry.set('owner-a', [
      { id: 'toggle', label: 'Toggle', enabled: () => visible.value },
    ])

    expect(registry.list.value).toHaveLength(0)

    visible.value = true

    expect(registry.list.value).toHaveLength(1)
    expect(registry.list.value[0]?.id).toBe('owner-a:toggle')
  })

  it('drops an owner entire contribution on remove', () => {
    const registry = createOwnedRegistry<TestEntry>()

    registry.set('owner-a', [{ id: 'one', label: 'One' }])
    registry.set('owner-b', [{ id: 'two', label: 'Two' }])
    registry.remove('owner-a')

    expect(registry.list.value.map((entry) => entry.id)).toEqual(['owner-b:two'])
  })
})

import { describe, expect, it } from 'vitest'
import {
  createDirtyTracker,
  isEditingEvent,
  isSaveShortcut,
  savedAgo,
  stableStringify,
} from '../app/composables/internal/content-dirty'

describe('stableStringify', () => {
  it('gives the same text for any key order, at any depth', () => {
    expect(stableStringify({ b: 1, a: { d: 1, c: 2 } })).toBe(stableStringify({ a: { c: 2, d: 1 }, b: 1 }))
  })

  it('keeps the order of an array', () => {
    expect(stableStringify({ a: [1, 2] })).not.toBe(stableStringify({ a: [2, 1] }))
  })

  it('gives an empty text for undefined', () => {
    expect(stableStringify(undefined)).toBe('')
  })
})

describe('createDirtyTracker', () => {
  it('is not dirty before it read a baseline', () => {
    const tracker = createDirtyTracker({ baseline: null })
    expect(tracker.isDirty('x')).toBe(false)
  })

  it('follows the item until the first edit, so a widget that settles is not an edit', () => {
    const state = { baseline: null as string | null }
    const tracker = createDirtyTracker(state)
    tracker.follow('loaded')
    tracker.follow('loaded and normalized')
    expect(tracker.isDirty('loaded and normalized')).toBe(false)
  })

  it('keeps the baseline after the first edit', () => {
    const state = { baseline: null as string | null }
    const tracker = createDirtyTracker(state)
    tracker.follow('a')
    tracker.interact()
    tracker.follow('b')
    expect(state.baseline).toBe('a')
    expect(tracker.isDirty('b')).toBe(true)
    expect(tracker.isDirty('a')).toBe(false)
  })

  it('takes a new baseline after a save', () => {
    const state = { baseline: null as string | null }
    const tracker = createDirtyTracker(state)
    tracker.follow('a')
    tracker.interact()
    tracker.reset('b')
    expect(tracker.isDirty('b')).toBe(false)
    tracker.follow('c')
    expect(tracker.isDirty('c')).toBe(true)
  })
})

describe('isSaveShortcut', () => {
  const key = { key: 's', ctrlKey: false, metaKey: false, shiftKey: false, altKey: false }

  it('matches Ctrl+S and Cmd+S', () => {
    expect(isSaveShortcut({ ...key, ctrlKey: true })).toBe(true)
    expect(isSaveShortcut({ ...key, metaKey: true })).toBe(true)
    expect(isSaveShortcut({ ...key, key: 'S', ctrlKey: true })).toBe(true)
  })

  it('does not match S alone, or with Shift or Alt', () => {
    expect(isSaveShortcut(key)).toBe(false)
    expect(isSaveShortcut({ ...key, ctrlKey: true, shiftKey: true })).toBe(false)
    expect(isSaveShortcut({ ...key, ctrlKey: true, altKey: true })).toBe(false)
    expect(isSaveShortcut({ ...key, key: 'a', ctrlKey: true })).toBe(false)
  })
})

describe('savedAgo', () => {
  it('says now under 45 seconds', () => {
    expect(savedAgo(0)).toEqual({ unit: 'now' })
    expect(savedAgo(44_000)).toEqual({ unit: 'now' })
    expect(savedAgo(-5000)).toEqual({ unit: 'now' })
  })

  it('uses minutes, hours, then days', () => {
    expect(savedAgo(50_000)).toEqual({ unit: 'minute', value: 1 })
    expect(savedAgo(2 * 60_000)).toEqual({ unit: 'minute', value: 2 })
    expect(savedAgo(3 * 3_600_000)).toEqual({ unit: 'hour', value: 3 })
    expect(savedAgo(2 * 86_400_000)).toEqual({ unit: 'day', value: 2 })
  })
})

describe('isEditingEvent', () => {
  const control = { closest: (selector: string) => (selector.includes('button') ? {} : null) }
  const page = { closest: () => null }

  it('counts a key press and a paste on any target', () => {
    expect(isEditingEvent('keydown', page)).toBe(true)
    expect(isEditingEvent('paste', null)).toBe(true)
  })

  it('counts a pointer press on a control only', () => {
    expect(isEditingEvent('pointerdown', control)).toBe(true)
    expect(isEditingEvent('pointerdown', page)).toBe(false)
    expect(isEditingEvent('pointerdown', null)).toBe(false)
  })
})

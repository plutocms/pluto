import { describe, expect, it } from 'vitest'
import {
  isTopModal,
  pushModal,
  removeModal,
} from '../app/composables/internal/modal-stack'

describe('modal stack', () => {
  it('makes the last opened modal the top one', () => {
    const first = Symbol('first')
    const second = Symbol('second')

    pushModal(first)
    expect(isTopModal(first)).toBe(true)

    pushModal(second)
    expect(isTopModal(second)).toBe(true)
    expect(isTopModal(first)).toBe(false)

    removeModal(second)
    expect(isTopModal(first)).toBe(true)

    removeModal(first)
    expect(isTopModal(first)).toBe(false)
  })

  it('ignores a second push and a remove of a closed modal', () => {
    const only = Symbol('only')

    pushModal(only)
    pushModal(only)
    removeModal(only)
    expect(isTopModal(only)).toBe(false)

    removeModal(only)
    expect(isTopModal(only)).toBe(false)
  })
})

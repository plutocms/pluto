import { describe, expect, it } from 'vitest'
import {
  canRedo,
  canUndo,
  createHistory,
  HISTORY_LIMIT,
  pushHistory,
  redo,
  resetHistory,
  undo,
} from '../shared/utils/blocks/history'

describe('block history', () => {
  it('undoes and redoes', () => {
    let history = createHistory('a')
    history = pushHistory(history, 'b', 0)
    history = pushHistory(history, 'c', 1)
    expect(history.present).toBe('c')
    history = undo(history)
    expect(history.present).toBe('b')
    history = undo(history)
    expect(history.present).toBe('a')
    expect(canUndo(history)).toBe(false)
    expect(undo(history)).toBe(history)
    history = redo(history)
    expect(history.present).toBe('b')
    expect(canRedo(history)).toBe(true)
    history = redo(redo(history))
    expect(history.present).toBe('c')
    expect(redo(history)).toBe(history)
  })

  it('clears the redo steps after a new push', () => {
    let history = pushHistory(createHistory('a'), 'b', 0)
    history = undo(history)
    history = pushHistory(history, 'x', 10)
    expect(canRedo(history)).toBe(false)
    expect(history.past).toEqual(['a'])
  })

  it('ignores a state equal to the present', () => {
    const history = createHistory({ n: 1 })
    expect(pushHistory(history, history.present, 0)).toBe(history)
  })

  it('joins typing in one block under 600 ms', () => {
    let history = createHistory('')
    history = pushHistory(history, 'h', 0, 'block-1')
    history = pushHistory(history, 'he', 200, 'block-1')
    history = pushHistory(history, 'hel', 500, 'block-1')
    expect(history.past).toEqual([''])
    expect(history.present).toBe('hel')
    // A pause longer than 600 ms from the last edit starts a new step.
    history = pushHistory(history, 'hell', 1200, 'block-1')
    expect(history.past).toEqual(['', 'hel'])
    // Another block starts a new step at once.
    history = pushHistory(history, 'hello', 1300, 'block-2')
    expect(history.past).toEqual(['', 'hel', 'hell'])
    // An edit without a key never joins.
    history = pushHistory(history, 'hello!', 1310)
    history = pushHistory(history, 'hello!!', 1320)
    expect(history.past).toHaveLength(5)
  })

  it('joins by the time of the last push, so long typing stays one step', () => {
    let history = pushHistory(createHistory(0), 1, 500, 'k')
    for (let step = 2; step < 20; step++) {
      history = pushHistory(history, step, step * 500, 'k')
    }
    expect(history.past).toEqual([0])
  })

  it('does not join after an undo', () => {
    let history = pushHistory(createHistory('a'), 'b', 0, 'k')
    history = pushHistory(history, 'c', 100, 'k')
    history = undo(history)
    expect(history.present).toBe('a')
    history = pushHistory(history, 'd', 150, 'k')
    expect(history.past).toEqual(['a'])
    expect(history.present).toBe('d')
  })

  it('keeps 100 steps', () => {
    let history = createHistory(0)
    for (let step = 1; step <= HISTORY_LIMIT + 50; step++) {
      history = pushHistory(history, step, step * 1000)
    }
    expect(history.past).toHaveLength(HISTORY_LIMIT)
    expect(history.past[0]).toBe(50)
    expect(history.present).toBe(HISTORY_LIMIT + 50)
  })

  it('starts again from a state', () => {
    const history = resetHistory('z')
    expect(history).toEqual({ past: [], present: 'z', future: [] })
  })
})

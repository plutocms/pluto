import type { PlutoBuildStatus } from '../modules/pluto-github/runtime/shared/build-status'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createBuildPoller } from '../modules/pluto-github/runtime/shared/build-poller'

function status(state: PlutoBuildStatus['state']): PlutoBuildStatus {
  return { sha: 'a'.repeat(40), shortSha: 'aaaaaaa', message: 'm', state, items: [] }
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

function setup(answers: (PlutoBuildStatus | Error)[]) {
  const hidden = { value: false }
  const load = vi.fn(async () => {
    const next = answers.length > 1 ? answers.shift()! : answers[0]!
    if (next instanceof Error) {
      throw next
    }
    return next
  })
  const seen: PlutoBuildStatus[] = []
  const errors: unknown[] = []
  const poller = createBuildPoller({
    load,
    onStatus: (value) => seen.push(value),
    onError: (error) => errors.push(error),
    isHidden: () => hidden.value,
  })
  return { load, seen, errors, poller, hidden }
}

describe('createBuildPoller', () => {
  it('reads at once, then every 5 seconds while pending, and stops when done', async () => {
    const { load, seen, poller } = setup([status('pending'), status('pending'), status('success')])
    poller.start()
    await vi.advanceTimersByTimeAsync(0)
    expect(load).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(4_999)
    expect(load).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1)
    expect(load).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(5_000)
    expect(load).toHaveBeenCalledTimes(3)
    await vi.advanceTimersByTimeAsync(60_000)
    expect(load).toHaveBeenCalledTimes(3)
    expect(seen.map((value) => value.state)).toEqual(['pending', 'pending', 'success'])
  })

  it('does not poll after a final state on open', async () => {
    const { load, poller } = setup([status('failure')])
    poller.start()
    await vi.advanceTimersByTimeAsync(30_000)
    expect(load).toHaveBeenCalledTimes(1)
  })

  it('stops after 15 minutes of pending', async () => {
    const { load, poller } = setup([status('pending')])
    poller.start()
    await vi.advanceTimersByTimeAsync(15 * 60_000 + 10_000)
    const calls = load.mock.calls.length
    expect(calls).toBeGreaterThan(100)
    expect(calls).toBeLessThanOrEqual(181)
    await vi.advanceTimersByTimeAsync(60_000)
    expect(load).toHaveBeenCalledTimes(calls)
  })

  it('waits for the checks after a save, for one minute', async () => {
    const { load, poller } = setup([status('none')])
    poller.start({ afterSave: true })
    await vi.advanceTimersByTimeAsync(30_000)
    expect(load.mock.calls.length).toBeGreaterThanOrEqual(6)
    await vi.advanceTimersByTimeAsync(40_000)
    const calls = load.mock.calls.length
    await vi.advanceTimersByTimeAsync(30_000)
    expect(load).toHaveBeenCalledTimes(calls)
  })

  it('asks nothing while the page is hidden, and reads again on resume', async () => {
    const { load, poller, hidden } = setup([status('pending')])
    poller.start()
    await vi.advanceTimersByTimeAsync(0)
    expect(load).toHaveBeenCalledTimes(1)
    hidden.value = true
    await vi.advanceTimersByTimeAsync(60_000)
    expect(load).toHaveBeenCalledTimes(1)
    hidden.value = false
    poller.resume()
    await vi.advanceTimersByTimeAsync(0)
    expect(load).toHaveBeenCalledTimes(2)
  })

  it('stop() ends the loop, and drops a read in progress', async () => {
    const { load, seen, poller } = setup([status('pending')])
    poller.start()
    poller.stop()
    await vi.advanceTimersByTimeAsync(30_000)
    expect(seen).toHaveLength(0)
    expect(load.mock.calls.length).toBeLessThanOrEqual(1)
  })

  it('a new start() replaces the old loop', async () => {
    const { load, poller } = setup([status('pending')])
    poller.start()
    await vi.advanceTimersByTimeAsync(0)
    poller.start({ afterSave: true })
    await vi.advanceTimersByTimeAsync(0)
    expect(load).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(5_000)
    // One timer only: one more read, not two.
    expect(load).toHaveBeenCalledTimes(3)
  })

  it('stops on 401 and 403', async () => {
    for (const statusCode of [401, 403]) {
      const { load, errors, poller } = setup([Object.assign(new Error('no'), { statusCode })])
      poller.start()
      await vi.advanceTimersByTimeAsync(120_000)
      expect(load).toHaveBeenCalledTimes(1)
      expect(errors).toHaveLength(1)
    }
  })

  it('retries after other errors with a growing delay, and gives up after 5', async () => {
    const { load, errors, poller } = setup([Object.assign(new Error('busy'), { statusCode: 503 })])
    poller.start()
    await vi.advanceTimersByTimeAsync(10 * 60_000)
    expect(load).toHaveBeenCalledTimes(5)
    expect(errors).toHaveLength(5)
  })
})

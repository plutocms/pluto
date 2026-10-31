// Undo and redo for the block doc. The history keeps snapshots of the doc.
// A snapshot is immutable, because every operation returns a new doc. The
// clock is a parameter, so a test needs no timers.

export const HISTORY_LIMIT = 100

/** Edits of the same key within this time (ms) join in one step. */
export const HISTORY_MERGE_MS = 600

export interface PlutoHistory<T> {
  /** Oldest first. */
  past: T[]
  present: T
  future: T[]
  /** The key and the time of the last push, to join typing in one block. */
  last?: { key: string; at: number }
}

export interface PlutoHistoryOptions {
  limit?: number
  mergeMs?: number
}

export function createHistory<T>(initial: T): PlutoHistory<T> {
  return { past: [], present: initial, future: [] }
}

export function canUndo(history: PlutoHistory<unknown>): boolean {
  return history.past.length > 0
}

export function canRedo(history: PlutoHistory<unknown>): boolean {
  return history.future.length > 0
}

/**
 * Adds a new state. A state equal (`===`) to the present is ignored. With a
 * `key` (for example the id of a block), a push with the same key within
 * `mergeMs` of the last push replaces the present, so it is one undo step.
 */
export function pushHistory<T>(
  history: PlutoHistory<T>,
  state: T,
  now: number,
  key?: string,
  options: PlutoHistoryOptions = {}
): PlutoHistory<T> {
  if (state === history.present) {
    return history
  }
  const limit = options.limit ?? HISTORY_LIMIT
  const mergeMs = options.mergeMs ?? HISTORY_MERGE_MS
  const merge =
    key !== undefined &&
    history.last?.key === key &&
    now - history.last.at <= mergeMs &&
    history.past.length > 0 &&
    history.future.length === 0
  const last = key === undefined ? undefined : { key, at: now }
  if (merge) {
    return { ...history, present: state, last }
  }
  return {
    past: [...history.past, history.present].slice(-limit),
    present: state,
    future: [],
    last,
  }
}

export function undo<T>(history: PlutoHistory<T>): PlutoHistory<T> {
  if (!canUndo(history)) {
    return history
  }
  const past = history.past.slice(0, -1)
  return {
    past,
    present: history.past.at(-1)!,
    future: [history.present, ...history.future],
  }
}

export function redo<T>(history: PlutoHistory<T>): PlutoHistory<T> {
  if (!canRedo(history)) {
    return history
  }
  const [present, ...future] = history.future
  return { past: [...history.past, history.present], present: present!, future }
}

/** Starts again from a state, for example after a switch to the Markdown mode. */
export function resetHistory<T>(state: T): PlutoHistory<T> {
  return createHistory(state)
}

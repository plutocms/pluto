// Pure part of the unsaved-changes guard of `PlutoContentForm`. It does not
// use Nuxt auto-imports, so plain Vitest can import it.

/**
 * JSON text of a value with the object keys sorted. Two values with the same
 * data give the same text, whatever the key order. The form compares the text
 * of the payload now with the text at the last save.
 */
export function stableStringify(value: unknown): string {
  return (
    JSON.stringify(value, (_key, entry) => {
      if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
        return Object.fromEntries(
          Object.entries(entry as Record<string, unknown>).toSorted(
            ([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)
          )
        )
      }
      return entry
    }) ?? ''
  )
}

export interface DirtyState {
  /** The text of the payload that counts as "saved". `null` until the form read it. */
  baseline: string | null
}

/**
 * Tracks whether the form has unsaved changes.
 *
 * A widget can change the value right after it mounts, for example an editor
 * that writes its own normal form of the text. That change is not an edit. So
 * the baseline follows the item until the user first edits (`interact`). After
 * that the baseline stays, until a save calls `reset`.
 *
 * `state` is a plain object, so a caller can pass a Vue `reactive` and watch it.
 */
export function createDirtyTracker(state: DirtyState) {
  let interacted = false

  return {
    /** Call it when the item changes. Before the first edit, the new value is the baseline. */
    follow(current: string) {
      if (!interacted) {
        state.baseline = current
      }
    },
    /** Call it on the first real user input. The baseline stays from now on. */
    interact() {
      interacted = true
    },
    /** Call it after a save. The saved value is the new baseline. */
    reset(current: string) {
      state.baseline = current
    },
    isDirty(current: string): boolean {
      return state.baseline !== null && state.baseline !== current
    },
  }
}

export interface ShortcutEvent {
  key: string
  ctrlKey: boolean
  metaKey: boolean
  shiftKey: boolean
  altKey: boolean
}

/** True for Ctrl+S on Windows and Linux, and Cmd+S on macOS. */
export function isSaveShortcut(event: ShortcutEvent): boolean {
  return (
    event.key.toLowerCase() === 's' &&
    (event.ctrlKey || event.metaKey) &&
    !event.shiftKey &&
    !event.altKey
  )
}

export type SavedAgo =
  | {
      unit: 'now'
    }
  | {
      unit: 'minute' | 'hour' | 'day'
      value: number
    }

/** How long ago a save happened, in whole units. Under 45 seconds is "now". */
export function savedAgo(diffMs: number): SavedAgo {
  const seconds = Math.max(0, diffMs) / 1000
  if (seconds < 45) {
    return { unit: 'now' }
  }
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) {
    return { unit: 'minute', value: Math.max(1, minutes) }
  }
  const hours = Math.round(minutes / 60)
  if (hours < 24) {
    return { unit: 'hour', value: hours }
  }
  return { unit: 'day', value: Math.round(hours / 24) }
}

/** The elements whose press changes the form value. A plain click on the page does not. */
const EDITING_TARGET =
  'button, a, input, select, textarea, label, [contenteditable], [draggable="true"], [role="option"], [role="menuitem"], [role="switch"], [role="checkbox"], [role="radio"], [role="combobox"], [role="tab"]'

/**
 * True when a user event can be an edit. A key press, a paste and a drop always
 * count. A pointer press counts on a control only. This keeps a click on the
 * empty page from freezing the baseline before a late widget settles.
 */
export function isEditingEvent(
  type: string,
  target: {
    closest?: (selector: string) => unknown
  } | null
): boolean {
  if (
    type === 'keydown' ||
    type === 'input' ||
    type === 'change' ||
    type === 'paste' ||
    type === 'drop'
  ) {
    return true
  }
  return Boolean(target?.closest?.(EDITING_TARGET))
}

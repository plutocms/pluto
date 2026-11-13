// No Nuxt auto-imports here: plain Vitest imports this file.

export interface DirtyState {
  baseline: string | null
}

export function createDirtyTracker(state: DirtyState) {
  let interacted = false

  return {
    follow(current: string) {
      if (!interacted) {
        state.baseline = current
      }
    },
    interact() {
      interacted = true
    },
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

const EDITING_TARGET =
  'button, a, input, select, textarea, label, [contenteditable], [draggable="true"], [role="option"], [role="menuitem"], [role="switch"], [role="checkbox"], [role="radio"], [role="combobox"], [role="tab"]'

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

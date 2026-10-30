// Nuxt auto-imports `app/composables/*.ts` at depth 1 only, so this file
// sits under `internal/` on purpose: it stays out of auto-import, and it can
// be unit-tested directly with an explicit import, outside a Nuxt build
// context. Import from 'vue' explicitly here, instead of relying on
// auto-import, so this file works the same way under plain Vitest.
import type { ComputedRef } from 'vue'
import { computed, markRaw, shallowRef } from 'vue'

export interface OwnedEntry {
  id: string
  order?: number
  enabled?: () => boolean
}

/**
 * An owner-keyed registry. Each owner (a layer id) contributes a list of
 * entries. Calling `set` again for the same owner replaces its whole
 * contribution — this makes registration idempotent, so re-running a
 * plugin (for example on HMR) never duplicates entries and needs no
 * dedupe warning.
 *
 * `list` merges every owner's entries, drops disabled ones, and sorts by
 * `order` (default 100), breaking ties by first-registration sequence.
 */
export function createOwnedRegistry<T extends OwnedEntry>() {
  const owners = shallowRef<Map<string, T[]>>(new Map())
  let sequence = 0
  const seq = new Map<string, number>()

  function set(owner: string, entries: T[]) {
    const next = new Map(owners.value)
    next.set(
      owner,
      entries.map((entry) => {
        const id = `${owner}:${entry.id}`
        if (!seq.has(id)) {
          seq.set(id, sequence++)
        }
        return markRaw({ ...entry, id }) as T
      })
    )
    owners.value = next
  }

  function remove(owner: string) {
    const next = new Map(owners.value)
    next.delete(owner)
    owners.value = next
  }

  const list: ComputedRef<T[]> = computed(() =>
    [...owners.value.values()]
      .flat()
      .filter((entry) => entry.enabled?.() ?? true)
      .sort(
        (a, b) =>
          (a.order ?? 100) - (b.order ?? 100) ||
          (seq.get(a.id) ?? 0) - (seq.get(b.id) ?? 0)
      )
  )

  return { set, remove, list }
}

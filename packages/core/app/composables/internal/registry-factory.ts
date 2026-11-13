import type { ComputedRef } from 'vue'
import { computed, markRaw, shallowRef } from 'vue'

export interface OwnedEntry {
  id: string
  order?: number
  enabled?: () => boolean
}

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

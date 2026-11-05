import type { PlutoReferenceOption } from './internal/reference-options'
import {
  findReferenceOption,
  isReferenceCacheFresh,
  referenceCreateBody,
  referenceOptionsFromItems,
} from './internal/reference-options'

interface ReferenceOptionsEntry {
  options: PlutoReferenceOption[]
  fetchedAt?: number
}

/** The most items that one widget loads. A longer list needs a server search. */
export const REFERENCE_OPTIONS_LIMIT = 1000

// One request at a time for each target, so two widgets of a page share the fetch.
const inflight = new Map<string, Promise<void>>()

/**
 * The choices of a `reference` field with a `target`: the items of the target content type, read
 * from the generic admin route (up to 1000). The options are shared by target, so the widgets of
 * a page read the list once. A widget that mounts more than 10 seconds after the last read reads
 * again.
 *
 * `create` makes a new item of the target from a typed title. It returns the option of an item
 * that has the same label or slug, without a request. On a 409 (an item with that slug exists)
 * it reads the list again and returns that item.
 */
export function usePlutoReferenceOptions(target: MaybeRefOrGetter<string>) {
  const name = computed(() => toValue(target))
  const { byName } = usePlutoContentTypes()
  const type = computed(() => byName(name.value))

  const state = useState<Record<string, ReferenceOptionsEntry>>(
    'pluto-reference-options',
    () => ({})
  )
  const pending = ref(false)
  const error = ref<unknown>(null)

  const options = computed(() => state.value[name.value]?.options ?? [])
  const byId = computed(
    () => new Map(options.value.map((option) => [String(option.value), option]))
  )

  function load(): Promise<void> {
    const key = name.value
    const running = inflight.get(key)
    if (running) {
      return running
    }
    pending.value = true
    error.value = null
    const request = $fetch<PlutoContentListResult>(
      `/api/_pluto/content/${key}`,
      { query: { limit: REFERENCE_OPTIONS_LIMIT } }
    )
      .then((result) => {
        state.value = {
          ...state.value,
          [key]: {
            options: referenceOptionsFromItems(type.value, result.data),
            fetchedAt: Date.now(),
          },
        }
      })
      .catch((cause: unknown) => {
        error.value = cause
      })
      .finally(() => {
        inflight.delete(key)
        pending.value = false
      })
    inflight.set(key, request)
    return request
  }

  /** Reads the list again. */
  function refresh(): Promise<void> {
    return load()
  }

  /** Reads the list unless a recent read exists. */
  function ensure(): Promise<void> {
    return isReferenceCacheFresh(state.value[name.value]?.fetchedAt, Date.now())
      ? Promise.resolve()
      : load()
  }

  async function create(title: string): Promise<PlutoReferenceOption> {
    const existing = findReferenceOption(options.value, title, slugifyTitle)
    if (existing) {
      return existing
    }
    const key = name.value
    let created: PlutoContentItem
    try {
      created = await $fetch<PlutoContentItem>(`/api/_pluto/content/${key}`, {
        method: 'POST',
        body: referenceCreateBody(type.value, title, slugifyTitle),
      })
    } catch (cause) {
      if ((cause as { statusCode?: number }).statusCode === 409) {
        await load()
        const match = findReferenceOption(options.value, title, slugifyTitle)
        if (match) {
          return match
        }
      }
      throw cause
    }
    const [option] = referenceOptionsFromItems(type.value, [created]) as [
      PlutoReferenceOption,
    ]
    const entry = state.value[key]
    state.value = {
      ...state.value,
      [key]: {
        options: [...(entry?.options ?? []), option].sort((a, b) =>
          a.label.localeCompare(b.label)
        ),
        fetchedAt: entry?.fetchedAt,
      },
    }
    return option
  }

  return { options, byId, pending, error, refresh, ensure, create }
}

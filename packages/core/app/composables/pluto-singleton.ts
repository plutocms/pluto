import type {
  PlutoItem,
  PlutoSingletonTypeName,
} from '../../shared/types/content-item'
import type { PlutoPublicItem } from '../../shared/types/public-api'
import { computed } from 'vue'
import { usePlutoEditLink } from './pluto-edit-link'
import { usePlutoPublicList } from './pluto-public'
import { extendPlutoAsyncData } from './pluto-site-content'

export interface PlutoSingletonOptions {
  /** Give the admin bar the "Edit" button of the type. Default true. */
  editLink?: boolean
}

/**
 * The item of a singleton type (`singleton: true`, `api.public: true`) for a site page: one call
 * of the public API (`?limit=1`), so a static build reads it from the public index too. `item` is
 * `null` until an editor saves the item, so a page keeps its own fallback text. Awaitable, like
 * `useFetch`. The admin bar gets "Edit <type>" (`adminBar.edit` of the type), also before the
 * first save.
 *
 * The singleton types declared with `defineContentType` in the app and its layers are the
 * suggested names (`PlutoSingletonTypeName`), and the name types `item`
 * (`usePlutoSingleton('contact')`, see `PlutoContentTypes`). Another name takes the item type as a
 * type argument.
 *
 * @see https://pluto.vulmix.dev/docs/build/public-api
 */
export function usePlutoSingleton<N extends PlutoSingletonTypeName>(
  type: N,
  options?: PlutoSingletonOptions
): ReturnType<typeof singleton<PlutoItem<N>>>
export function usePlutoSingleton<T = PlutoPublicItem>(
  type: string,
  options?: PlutoSingletonOptions
): ReturnType<typeof singleton<T>>
export function usePlutoSingleton(
  type: string,
  options: PlutoSingletonOptions = {}
) {
  return singleton(type, options)
}

function singleton<T>(type: string, options: PlutoSingletonOptions) {
  const fetch = usePlutoPublicList<T>(type, { limit: 1 })
  const item = computed<T | null>(() => fetch.data.value?.data[0] ?? null)

  if (options.editLink !== false) {
    usePlutoEditLink(
      type,
      () => (item.value as { id?: string | number } | null)?.id ?? type
    )
  }

  return extendPlutoAsyncData(fetch, { item })
}

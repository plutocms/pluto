import type { MaybeRefOrGetter } from 'vue'
import type { PlutoPublicItem, PlutoPublicList, PlutoPublicOne, PlutoPublicQuery } from '../../shared/types/public-api'
import { computed, toValue } from 'vue'
import { plutoContentApiPath, plutoPublicQueryParams } from '../../shared/utils/public-api'

/**
 * The published items of a public content type, from the public API
 * (`/api/pluto/v1/content/<type>`). It runs on the server too, so the page HTML holds the list.
 * `data.value` is `{ data, meta: { total, limit, offset } }`. The type must set `api.public`.
 *
 * @example
 * const { data } = await usePlutoPublicList('post', { limit: 10, sort: '-publishedAt' })
 */
export function usePlutoPublicList<T = PlutoPublicItem>(
  type: MaybeRefOrGetter<string>,
  query: MaybeRefOrGetter<PlutoPublicQuery> = {}
) {
  const params = computed(() => plutoPublicQueryParams(toValue(query)))
  return useFetch<PlutoPublicList<T>>(() => plutoContentApiPath(toValue(type)), {
    key: computed(() => `pluto-public-list:${toValue(type)}:${JSON.stringify(params.value)}`),
    query: params,
  })
}

/**
 * One published item of a public content type, by id or slug. `data.value` is `{ data }`. A draft
 * or a missing item gives a 404 in `error`.
 *
 * @example
 * const { data } = await usePlutoPublicItem('post', () => String(route.params.slug))
 */
export function usePlutoPublicItem<T = PlutoPublicItem>(
  type: MaybeRefOrGetter<string>,
  id: MaybeRefOrGetter<string | number>
) {
  return useFetch<PlutoPublicOne<T>>(() => plutoContentApiPath(toValue(type), toValue(id)), {
    key: computed(() => `pluto-public-item:${toValue(type)}:${toValue(id)}`),
  })
}

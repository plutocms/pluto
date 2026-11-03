import type { MaybeRefOrGetter } from 'vue'
import type {
  PlutoPublicItem,
  PlutoPublicList,
  PlutoPublicOne,
  PlutoPublicQuery,
  PlutoPublicSurround,
} from '../../shared/types/public-api'
import { computed, toValue } from 'vue'
import {
  plutoContentApiPath,
  plutoPublicQueryParams,
  plutoSurroundApiPath,
} from '../../shared/utils/public-api'

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
  return useFetch<PlutoPublicList<T>>(
    () => plutoContentApiPath(toValue(type)),
    {
      key: computed(
        () =>
          `pluto-public-list:${toValue(type)}:${JSON.stringify(params.value)}`
      ),
      query: params,
    }
  )
}

/**
 * One published item of a public content type, by id or slug. `data.value` is `{ data, meta? }`.
 * A draft or a missing item gives a 404 in `error`. With `drafts` true, an editor of the type
 * also gets a draft, with `meta.draft` (the request carries `?drafts=1`; for anyone else it
 * changes nothing).
 *
 * @example
 * const { data } = await usePlutoPublicItem('post', () => String(route.params.slug))
 */
export function usePlutoPublicItem<T = PlutoPublicItem>(
  type: MaybeRefOrGetter<string>,
  id: MaybeRefOrGetter<string | number>,
  options: {
    drafts?: MaybeRefOrGetter<boolean>
  } = {}
) {
  const drafts = computed(() => toValue(options.drafts) === true)
  return useFetch<PlutoPublicOne<T>>(
    () => plutoContentApiPath(toValue(type), toValue(id)),
    {
      key: computed(
        () =>
          `pluto-public-item:${toValue(type)}:${toValue(id)}${drafts.value ? ':drafts' : ''}`
      ),
      query: computed(() => (drafts.value ? { drafts: '1' } : {})),
    }
  )
}

/**
 * The published items before and after one item (`data.value.data` is `{ previous, next }`), in
 * the order of `sort` (default: the `defaultSort` of the type), with an optional `filter`.
 *
 * @example
 * const { data } = await usePlutoPublicSurround('post', slug, { sort: '-publishedAt' })
 */
export function usePlutoPublicSurround<T = PlutoPublicItem>(
  type: MaybeRefOrGetter<string>,
  id: MaybeRefOrGetter<string | number>,
  query: MaybeRefOrGetter<Pick<PlutoPublicQuery, 'sort' | 'filter'>> = {}
) {
  const params = computed(() => plutoPublicQueryParams(toValue(query)))
  return useFetch<PlutoPublicOne<PlutoPublicSurround<T>>>(
    () => plutoSurroundApiPath(toValue(type), toValue(id)),
    {
      key: computed(
        () =>
          `pluto-public-surround:${toValue(type)}:${toValue(id)}:${JSON.stringify(params.value)}`
      ),
      query: params,
    }
  )
}

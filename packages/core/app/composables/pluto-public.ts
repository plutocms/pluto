import type { MaybeRefOrGetter } from 'vue'
import type {
  PlutoPublicIndex,
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
import {
  PLUTO_PUBLIC_INDEX_PATH,
  queryPublicIndex,
} from '../../shared/utils/public-index'

/**
 * The published items of a public content type, from the public API
 * (`/api/pluto/v1/content/<type>`). It runs on the server too, so the page HTML holds the list.
 * `data.value` is `{ data, meta: { total, limit, offset } }`. The type must set `api.public`.
 * On a static site (`public.plutoPublicApi.static`), the browser answers from the public index
 * (`/api/pluto/v1/index.json`), so a search and the other pages work with no server.
 *
 * @example
 * const { data } = await usePlutoPublicList('post', { limit: 10, sort: '-publishedAt' })
 */
export function usePlutoPublicList<T = PlutoPublicItem>(
  type: MaybeRefOrGetter<string>,
  query: MaybeRefOrGetter<PlutoPublicQuery> = {}
) {
  const params = computed(() => plutoPublicQueryParams(toValue(query)))
  const staticSite = useRuntimeConfig().public.plutoPublicApi?.static === true
  return useFetch<PlutoPublicList<T>>(
    () => plutoContentApiPath(toValue(type)),
    {
      key: computed(
        () =>
          `pluto-public-list:${toValue(type)}:${JSON.stringify(params.value)}`
      ),
      query: params,
      // The prerender asks the real API. The browser of a static site has none.
      ...(import.meta.client &&
        staticSite && {
          $fetch: ((
            _request: string,
            options?: { query?: Record<string, unknown> }
          ) => queryStaticList(toValue(type), options?.query)) as typeof $fetch,
        }),
    }
  )
}

let staticIndex: Promise<PlutoPublicIndex> | undefined

/** The list answer of a static site, from the public index. The browser loads the index once. */
async function queryStaticList<T>(
  type: string,
  query: Record<string, unknown> = {}
): Promise<PlutoPublicList<T>> {
  staticIndex ??= $fetch<PlutoPublicIndex>(PLUTO_PUBLIC_INDEX_PATH).catch(
    (error: unknown) => {
      staticIndex = undefined
      throw error
    }
  )
  const entry = (await staticIndex).types[type]
  if (!entry) {
    throw createError({
      statusCode: 404,
      statusMessage: `The content type "${type}" is not in the public index.`,
    })
  }
  return queryPublicIndex<T>(entry, query)
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

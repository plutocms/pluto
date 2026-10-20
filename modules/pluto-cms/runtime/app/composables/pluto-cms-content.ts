import type { MaybeRefOrGetter } from 'vue'
import type { PlutoCmsItem, PlutoCmsListResult } from '../../shared/public-types'
import { computed, toValue } from 'vue'
import { useFetch } from '#imports'

export type { PlutoCmsItem, PlutoCmsListItem, PlutoCmsListResult } from '../../shared/public-types'

export const CMS_PUBLIC_URL = '/api/_pluto/cms'

export interface PlutoCmsListOptions {
  /** 1 to 100. Default 20. */
  limit?: MaybeRefOrGetter<number | undefined>
  /** Default 0. */
  offset?: MaybeRefOrGetter<number | undefined>
}

/**
 * The published items of one content type, newest first. It runs on the
 * server too, so the page HTML holds the list. Each item has an `excerpt` and
 * no body. The key holds the type, the limit and the offset.
 *
 * @example
 * const { data } = await usePlutoCmsList('post', { limit: 10 })
 */
export function usePlutoCmsList(type: MaybeRefOrGetter<string>, options: PlutoCmsListOptions = {}) {
  const query = computed(() => ({
    limit: toValue(options.limit),
    offset: toValue(options.offset),
  }))

  return useFetch<PlutoCmsListResult>(() => `${CMS_PUBLIC_URL}/${encodeURIComponent(toValue(type))}`, {
    key: computed(() => `pluto-cms-list:${toValue(type)}:${query.value.limit ?? ''}:${query.value.offset ?? ''}`),
    query,
  })
}

/**
 * One published item with its body as sanitized HTML in `html`. Show it with
 * `PlutoMarkdown`. A draft or a missing slug gives a 404 in `error`.
 *
 * @example
 * const { data: post } = await usePlutoCmsItem('post', String(route.params.slug))
 */
export function usePlutoCmsItem(type: MaybeRefOrGetter<string>, slug: MaybeRefOrGetter<string>) {
  return useFetch<PlutoCmsItem>(
    () => `${CMS_PUBLIC_URL}/${encodeURIComponent(toValue(type))}/${encodeURIComponent(toValue(slug))}`,
    { key: computed(() => `pluto-cms-item:${toValue(type)}:${toValue(slug)}`) }
  )
}

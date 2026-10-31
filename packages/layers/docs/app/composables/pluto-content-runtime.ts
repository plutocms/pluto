// The read side of the public pages. These composables hide the render mode
// (`plutoDocs.render`). In `'build'` mode they call Nuxt Content's
// `queryCollection`. In `'hybrid'` and `'runtime'` mode they call the layer's server routes:
// `'runtime'` reads the Markdown from the content repository, and `'hybrid'` serves the build
// data until a file differs from the build. A site calls only these, so a switch
// of the mode needs no change in its pages. See the docs-setup skill.

import type { MaybeRefOrGetter } from 'vue'

/**
 * A page of the public site. In `'build'` mode it is a Nuxt Content page. In the other
 * modes it has the same fields that the pages use: `id`, `stem`, `extension`, `path`,
 * `title`, `description`, `seo`, `navigation`, `meta`, the other frontmatter keys and
 * `body` (with `body.toc`). Pass it to `ContentRenderer`.
 */
export interface PlutoContentPage {
  id: string
  stem: string
  extension: string
  path: string
  title: string
  description: string
  seo?: { title?: string; description?: string }
  navigation?: false | { title?: string; icon?: string }

  body: any

  [key: string]: any
}

/** A node of the navigation tree. The shape of `ContentNavigationItem` of Nuxt Content. */
export interface PlutoContentNavigationItem {
  title: string
  path: string
  stem?: string
  children?: PlutoContentNavigationItem[]
  page?: false
  icon?: string

  [key: string]: any
}

/** The previous or the next page. Like Nuxt Content, the type has no `null`, but an end of the list is `null` at run time. */
export interface PlutoContentSurroundItem {
  title: string
  path: string
  description?: string

  [key: string]: any
}

export interface PlutoContentReadOptions {
  /**
   * The Nuxt Content collection to query in `'build'` and `'hybrid'` mode, for example `docs`.
   * Required there. The collection config of the site decides which files it holds.
   */
  collection?: string
  /** The content type to read in `'hybrid'` and `'runtime'` mode. Default: the first type of the layer. */
  type?: string
}

export interface PlutoContentNavigationOptions extends PlutoContentReadOptions {
  /**
   * `'hybrid'` and `'runtime'` mode only: keep the root `index` page in the tree when the tree
   * comes from the store. Default false, because the root page is the landing page. In `'build'`
   * mode, and in `'hybrid'` mode while the build data answers, the collection decides.
   */
  includeRoot?: boolean
}

/** `'hybrid'`, `'build'` or `'runtime'`: the render mode of the site. */
export function usePlutoContentRender(): 'hybrid' | 'build' | 'runtime' {
  const render = useRuntimeConfig().public.plutoDocs?.render
  return render === 'runtime' || render === 'hybrid' ? render : 'build'
}

function runtimeTypeName(options: PlutoContentReadOptions): string {
  const config = useRuntimeConfig().public.plutoDocs as unknown as
    { types?: Array<{ name: string }> } | undefined
  const name = options.type ?? config?.types?.[0]?.name
  if (!name) {
    throw new Error(
      '[pluto-docs] No content type is registered. Add one to plutoDocs.types.'
    )
  }
  return name
}

function buildCollection(
  options: PlutoContentReadOptions,
  caller: string
): string {
  if (!options.collection) {
    throw new Error(
      `[pluto-docs] ${caller} needs the "collection" option in build mode.`
    )
  }
  return options.collection
}

function normalizePath(path: string): string {
  return path.length > 1 ? path.replace(/\/+$/, '') : path
}

/** A route of the layer on the public API of Pluto. See `RUNTIME_ROUTE_BASE` in the module. */
function routeUrl(
  type: string,
  name: 'page' | 'navigation' | 'surround'
): string {
  return `/api/pluto/v1/docs/${encodeURIComponent(type)}/${name}`
}

/** Runs a server route and returns its `data`. A 404 gives `null`. Any other error is thrown. */
async function fetchRoute<T>(
  url: string,
  query: Record<string, string | undefined>
): Promise<T | null> {
  try {
    const answer = await $fetch<{ data: T }>(url, { query })
    return answer.data
  } catch (error) {
    if ((error as { statusCode?: number }).statusCode === 404) {
      return null
    }
    throw error
  }
}

/**
 * The page at a route path, or `null` when there is none. Returns the result of
 * `useAsyncData`, so `await` it in `<script setup>`. The path follows the ref.
 *
 * @example
 * const { data: page } = await usePlutoContentPage(() => route.path, { collection: 'docs' })
 */
export function usePlutoContentPage(
  path: MaybeRefOrGetter<string>,
  options: PlutoContentReadOptions = {}
) {
  const mode = usePlutoContentRender()
  const key = computed(
    () =>
      `pluto-content-page:${mode}:${options.collection ?? options.type ?? ''}:${normalizePath(toValue(path))}`
  )
  return useAsyncData<PlutoContentPage | null>(
    () => key.value,
    async () => {
      const current = normalizePath(toValue(path))
      if (mode !== 'build') {
        return fetchRoute<PlutoContentPage>(
          routeUrl(runtimeTypeName(options), 'page'),
          { path: current, collection: options.collection }
        )
      }
      // The collection name is a string here. The generated types know the names of the site.
      const page = await queryCollection(
        buildCollection(options, 'usePlutoContentPage') as never
      )
        .path(current)
        .first()
      return (page as PlutoContentPage | null) ?? null
    },
    { watch: [key] }
  )
}

/**
 * The navigation tree. The shape is the same in both modes, so it goes to `UContentNavigation`,
 * `UContentSearch` and `findPageHeadline`.
 *
 * Folder titles, icons and the other keys of a `.navigation.yml` file apply in every mode: Nuxt
 * Content reads them at build time, and the server reads them from the store at run time.
 */
export function usePlutoContentNavigation(
  options: PlutoContentNavigationOptions = {}
) {
  const mode = usePlutoContentRender()
  return useAsyncData<PlutoContentNavigationItem[]>(
    `pluto-content-navigation:${mode}:${options.collection ?? options.type ?? ''}`,
    async () => {
      if (mode !== 'build') {
        const tree = await fetchRoute<PlutoContentNavigationItem[]>(
          routeUrl(runtimeTypeName(options), 'navigation'),
          {
            collection: options.collection,
            includeRoot: options.includeRoot ? '1' : undefined,
          }
        )
        return tree ?? []
      }
      return (await queryCollectionNavigation(
        buildCollection(options, 'usePlutoContentNavigation') as never
      )) as PlutoContentNavigationItem[]
    }
  )
}

/**
 * The previous and the next page of a route path: `[previous, next]`, each one an item or
 * `null`. Each item has `title`, `path` and `description`.
 */
export function usePlutoContentSurround(
  path: MaybeRefOrGetter<string>,
  options: PlutoContentNavigationOptions = {}
) {
  const mode = usePlutoContentRender()
  const key = computed(
    () =>
      `pluto-content-surround:${mode}:${options.collection ?? options.type ?? ''}:${normalizePath(toValue(path))}`
  )
  return useAsyncData<PlutoContentSurroundItem[]>(
    () => key.value,
    async () => {
      const current = normalizePath(toValue(path))
      if (mode !== 'build') {
        const surround = await fetchRoute<PlutoContentSurroundItem[]>(
          routeUrl(runtimeTypeName(options), 'surround'),
          {
            path: current,
            collection: options.collection,
            includeRoot: options.includeRoot ? '1' : undefined,
          }
        )
        return surround ?? []
      }
      const surround = await queryCollectionItemSurroundings(
        buildCollection(options, 'usePlutoContentSurround') as never,
        current,
        {
          fields: ['description'],
        }
      )
      return surround as PlutoContentSurroundItem[]
    },
    { watch: [key] }
  )
}

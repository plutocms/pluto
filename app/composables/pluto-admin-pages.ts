import { contentTextFor } from './internal/content-text'

/**
 * Metadata for admin pages, registered on top of routes Nuxt already
 * creates from files, plus two synthesized entries per auto-routed content
 * type (`type.autoRoutes !== false`): a list page and a "new" page — the
 * page-metadata equivalent of the nav entry `usePlutoAdminNav` synthesizes
 * for the same content type. No layer registers page metadata today, so
 * the registry bucket itself has no legacy bridge.
 *
 * Titles are key-or-literal. They resolve with `tx()` inside the `computed`,
 * so a locale switch updates them.
 */
export function usePlutoAdminPages() {
  const registry = usePlutoRegistry()
  const route = useRoute()
  const { items: contentTypes } = usePlutoContentTypes()
  const i18n = usePlutoI18n()
  const { t, tx } = i18n

  const items = computed<PlutoAdminPage[]>(() => {
    const contentPages: PlutoAdminPage[] = contentTypes.value
      .filter((entry) => entry.type.autoRoutes !== false)
      .flatMap((entry) => {
        const type = entry.type
        const text = contentTextFor(type, i18n)
        const basePath = type.basePath ?? `/admin/content/${type.name}`
        const navId = `content:${type.name}`

        return [
          { id: `${navId}:list`, path: basePath, title: text.labelPlural },
          {
            id: `${navId}:new`,
            path: `${basePath}/new`,
            title: t('pluto.content.createNew', { label: text.label }),
            parent: navId,
          },
        ]
      })

    const registered = registry.pages.list.value.map((page) => ({ ...page, title: tx(page.title) }))

    return [...registered, ...contentPages]
  })

  const current = computed(() => items.value.find((page) => page.path === route.path))

  return { items, current }
}

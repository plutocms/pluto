/**
 * Metadata for admin pages, registered on top of routes Nuxt already
 * creates from files, plus two synthesized entries per auto-routed content
 * type (`type.autoRoutes !== false`): a list page and a "new" page — the
 * page-metadata equivalent of the nav entry `usePlutoAdminNav` synthesizes
 * for the same content type. No layer registers page metadata today, so
 * the registry bucket itself has no legacy bridge.
 */
export function usePlutoAdminPages() {
  const registry = usePlutoRegistry()
  const route = useRoute()
  const { items: contentTypes } = usePlutoContentTypes()

  const items = computed<PlutoAdminPage[]>(() => {
    const contentPages: PlutoAdminPage[] = contentTypes.value
      .filter((entry) => entry.type.autoRoutes !== false)
      .flatMap((entry) => {
        const type = entry.type
        const basePath = type.basePath ?? `/admin/content/${type.name}`
        const navId = `content:${type.name}`

        return [
          { id: `${navId}:list`, path: basePath, title: type.labelPlural },
          {
            id: `${navId}:new`,
            path: `${basePath}/new`,
            title: `Create new ${type.label}`,
            parent: navId,
          },
        ]
      })

    return [...registry.pages.list.value, ...contentPages]
  })

  const current = computed(() => items.value.find((page) => page.path === route.path))

  return { items, current }
}

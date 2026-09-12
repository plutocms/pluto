/**
 * Metadata for admin pages, registered on top of routes Nuxt already
 * creates from files. No layer registers page metadata today, so this has
 * no legacy bridge.
 */
export function usePlutoAdminPages() {
  const registry = usePlutoRegistry()
  const route = useRoute()

  const items = computed(() => registry.pages.list.value)
  const current = computed(() => items.value.find((page) => page.path === route.path))

  return { items, current }
}

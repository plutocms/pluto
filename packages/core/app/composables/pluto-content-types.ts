import type { PlutoContentType } from '../../shared/types/content'
import { computed } from 'vue'
import { applyContentTypeExtensions } from '../../shared/utils/content'

/**
 * Content types declared by every layer, in registry order, with the extensions of the layers
 * (`contentTypeExtensions`) applied.
 */
export function usePlutoContentTypes() {
  const registry = usePlutoRegistry()

  const items = computed(() => {
    const extensions = registry.contentTypeExtensions.list.value
    return registry.contentTypes.list.value.map((entry) => ({
      ...entry,
      type: applyContentTypeExtensions(entry.type, extensions),
    }))
  })

  /** Looks up a content type by its own `name`, not the registry entry `id`. */
  function byName(name: string): PlutoContentType | undefined {
    return items.value.find((entry) => entry.type.name === name)?.type
  }

  return { items, byName }
}

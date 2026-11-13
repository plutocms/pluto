import type { PlutoContentType } from '../../shared/types/content'
import { computed } from 'vue'

/**
 * Content types declared by every layer, in registry order, with the extensions of the layers
 * (`contentTypeExtensions`) applied.
 *
 * @see https://pluto.vulmix.dev/docs/reference/content-model
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

  function byName(name: string): PlutoContentType | undefined {
    return items.value.find((entry) => entry.type.name === name)?.type
  }

  return { items, byName }
}

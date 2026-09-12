/** Content types declared by every layer, in registry order. */
export function usePlutoContentTypes() {
  const registry = usePlutoRegistry()

  /** Looks up a content type by its own `name`, not the registry entry `id`. */
  function byName(name: string): PlutoContentType | undefined {
    return registry.contentTypes.list.value.find((entry) => entry.type.name === name)?.type
  }

  return { items: registry.contentTypes.list, byName }
}

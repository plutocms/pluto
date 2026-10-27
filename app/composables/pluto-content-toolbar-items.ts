/**
 * The `PlutoContentToolbarItem` components that apply to one content type.
 * Matches an entry whose `contentType` is `typeName` or `'*'`, the same rule as
 * `usePlutoContentActions`. The list follows `order`, because the registry sorts it.
 */
export function usePlutoContentToolbarItems(typeName: string) {
  const registry = usePlutoRegistry()

  return computed(() =>
    registry.contentToolbarItems.list.value.filter(
      (item) => item.contentType === typeName || item.contentType === '*'
    )
  )
}

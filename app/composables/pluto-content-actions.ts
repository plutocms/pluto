/**
 * The `PlutoContentAction` entries that apply to one content type, at one
 * placement. Matches an entry whose `contentType` is `typeName` or `'*'`,
 * the same matching rule `usePlutoContentFieldWidget` uses for field type.
 * `placement` defaults to 'toolbar', matching `PlutoContentAction.placement`.
 */
export function usePlutoContentActions(typeName: string, placement: 'toolbar' | 'aside' = 'toolbar') {
  const registry = usePlutoRegistry()

  return computed(() =>
    registry.contentActions.list.value.filter(
      (action) =>
        (action.contentType === typeName || action.contentType === '*') &&
        (action.placement ?? 'toolbar') === placement
    )
  )
}

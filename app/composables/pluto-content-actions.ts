/**
 * The `PlutoContentAction` entries that apply to one content type, at one
 * placement. Matches an entry whose `contentType` is `typeName` or `'*'`,
 * the same matching rule `usePlutoContentFieldWidget` uses for field type.
 * `placement` defaults to 'toolbar', matching `PlutoContentAction.placement`.
 * The label is key-or-literal. It resolves with `tx()` inside the `computed`.
 */
export function usePlutoContentActions(typeName: string, placement: 'toolbar' | 'aside' = 'toolbar') {
  const registry = usePlutoRegistry()
  const { tx } = usePlutoI18n()

  return computed(() =>
    registry.contentActions.list.value
      .filter(
        (action) =>
          (action.contentType === typeName || action.contentType === '*') &&
          (action.placement ?? 'toolbar') === placement
      )
      .map((action) => ({ ...action, label: tx(action.label) }))
  )
}

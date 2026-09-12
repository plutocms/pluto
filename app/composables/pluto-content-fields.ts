/**
 * Resolves the component that renders `field` in the generic content form
 * (a later wave). Matches an exact `widget` name first — a field can force
 * a specific widget through `PlutoFieldBase.widget` — then falls back to
 * the last-registered entry for the field's `type`. Returns `undefined`
 * when nothing matches: this wave adds no fallback placeholder component,
 * that is later, UI-wave work.
 */
export function usePlutoContentFieldWidget(field: PlutoField) {
  const registry = usePlutoRegistry()

  return computed<Component | undefined>(() => {
    const entries = registry.contentFieldWidgets.list.value

    if (field.widget) {
      const exact = entries.find((entry) => entry.widget === field.widget)
      if (exact) {
        return exact.component
      }
    }

    return entries.filter((entry) => entry.fieldType === field.type).at(-1)?.component
  })
}

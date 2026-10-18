/**
 * Widgets shown on the admin dashboard (`/admin/home`). A widget title is
 * key-or-literal. It resolves with `tx()` inside the `computed`, so a locale
 * switch updates it.
 */
export function usePlutoDashboardWidgets() {
  const registry = usePlutoRegistry()
  const { tx } = usePlutoI18n()

  const items = computed<PlutoDashboardWidget[]>(() =>
    registry.dashboardWidgets.list.value.map((widget) => ({
      ...widget,
      title: widget.title === undefined ? undefined : tx(widget.title),
    }))
  )

  return { items }
}

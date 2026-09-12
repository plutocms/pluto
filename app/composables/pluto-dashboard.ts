/** Widgets shown on the admin dashboard (`/admin/home`). */
export function usePlutoDashboardWidgets() {
  const registry = usePlutoRegistry()
  return { items: registry.dashboardWidgets.list }
}

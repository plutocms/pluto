const actions = ref<any[]>([])

export function useSidebarAdminActions() {
  const addAction = (action: any[]) => {
    actions.value = [...actions.value, ...action]
  }

  return {
    actions,
    addAction,
  }
}

const actions = ref([])

export function useNavbarAdminActions() {
  const addAction = (action: Component) => {
    actions.value.push(action as never)
  }

  return {
    actions,
    addAction,
  }
}

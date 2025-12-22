const actions = ref<Component[]>([])

export function useNavbarAdminActions() {
  const addAction = (action: Component) => {
    actions.value.push(action)
  }

  return {
    actions,
    addAction,
  }
}

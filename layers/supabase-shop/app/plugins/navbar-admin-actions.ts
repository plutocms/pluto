import NavbarAdminActions from '../components/NavbarAdminActions.vue'

export default defineNuxtPlugin(() => {
  const { addAction } = useNavbarAdminActions()

  addAction(markRaw(NavbarAdminActions))
})

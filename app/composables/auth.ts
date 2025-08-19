// We use `useRoute` from `vue-router` to suppress Nuxt warnings.
import { useRoute } from 'vue-router'

export function useAuth() {
  const toast = useToast()
  const supabase = useSupabaseClient()
  const user = useSupabaseUser()
  const route = useRoute()

  const userData = computed(() => user.value?.user_metadata)

  const isLoggedIn = computed<boolean>(() => !!user.value)
  const isSubmitting = ref<boolean>(false)

  interface LoginForm {
    email: string
    password: string
  }

  async function login(form: LoginForm) {
    isSubmitting.value = true

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: form.email,
        password: form.password,
      })

      if (error) {
        toast.add({
          title: 'Uh oh! Something went wrong.',
          description: error?.message,
          icon: 'lucide:circle-x',
          color: 'error',
        })
      }

      navigateTo((route.query.redirect as string) ?? '/admin/home')
    } catch (error) {
      if (import.meta.dev) {
        console.error(error)
      }

      toast.add({
        title: 'Uh oh! Something went wrong.',
        description: 'This was not your fault. It was ours.',
        icon: 'lucide:circle-x',
        color: 'error',
      })

      isSubmitting.value = false
    }
  }

  interface LogoutOptions {
    redirectTo?: string
    showToast?: boolean
  }

  async function logout(options?: LogoutOptions) {
    await supabase.auth.signOut()

    await nextTick()

    if (options?.showToast) {
      toast.add({
        title: 'Logged out',
        description: 'You have been logged out successfully.',
        icon: 'lucide:check',
        color: 'success',
      })
    }

    if (options?.redirectTo) {
      return navigateTo(`/admin/login?redirect=${options.redirectTo}`)
    }

    if (route.path.startsWith('/admin')) {
      navigateTo('/admin/login')
    }
  }

  return {
    isLoggedIn,
    isSubmitting,
    user,
    userData,
    login,
    logout,
  }
}

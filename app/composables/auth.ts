export function useAuth() {
  const toast = useToast()
  const supabase = useSupabaseClient()
  const user = useSupabaseUser()

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

      navigateTo('/admin')
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
  }

  function logout(options?: LogoutOptions) {
    supabase.auth.signOut()

    if (options?.redirectTo) {
      navigateTo(options.redirectTo)
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

<script setup lang="ts">
interface Form {
  email: string
  password: string
}

definePageMeta({
  layout: 'auth',
})

useHead({
  title: 'Login',
})

const supabase = useSupabaseClient()
const toast = useToast()

const form = ref<Form>({
  email: '',
  password: '',
})

const isSubmitting = ref<boolean>(false)

async function submitForm() {
  isSubmitting.value = true

  try {
    const { error } = await supabase.auth.signInWithPassword({
      email: form.value.email,
      password: form.value.password,
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
</script>

<template>
  <div class="grid h-full place-items-center">
    <UCard class="w-[400px]">
      <form @submit.prevent="submitForm">
        <div class="flex flex-col gap-y-6">
          <h1>Login</h1>

          <UFormField>
            <UInput
              v-model="form.email"
              placeholder="victor@example.com"
              class="w-full"
            />
          </UFormField>

          <UFormField>
            <UInput
              v-model="form.password"
              placeholder="••••"
              class="w-full"
              type="password"
            />
          </UFormField>

          <div class="flex items-center justify-between gap-x-4">
            <UFormField>
              <UButton
                :loading="isSubmitting"
                type="submit"
                icon="lucide:log-in"
              >
                Login
              </UButton>
            </UFormField>

            <UFormField>
              <UButton variant="link" to="/admin/signup" class="px-0">
                Create Account
              </UButton>
            </UFormField>
          </div>
        </div>
      </form>
    </UCard>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: 'auth',
})

useHead({
  title: 'Sign Up',
})

const supabase = useSupabaseClient()

const form = ref({
  email: '',
  first_name: '',
  last_name: '',
  password: '',
})

async function submitForm() {
  await supabase.auth.signUp({
    email: form.value.email,
    password: form.value.password,
    options: {
      data: {
        first_name: form.value.first_name,
        last_name: form.value.last_name,
      },
    },
  })

  navigateTo('/admin')
}
</script>

<template>
  <div class="grid h-full place-items-center">
    <UCard class="w-[400px]">
      <form @submit.prevent="submitForm">
        <div class="flex flex-col gap-y-6">
          <h1>Create Account</h1>

          <UFormField>
            <UInput
              v-model="form.email"
              type="email"
              placeholder="victor@example.com"
              class="w-full"
            />
          </UFormField>

          <div class="flex gap-x-4">
            <UFormField>
              <UInput
                v-model="form.first_name"
                placeholder="e.g: John"
                class="w-full"
              />
            </UFormField>

            <UFormField>
              <UInput
                v-model="form.last_name"
                placeholder="e.g: Doe"
                class="w-full"
              />
            </UFormField>
          </div>

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
                to="/admin/login"
                icon="lucide:arrow-left"
                variant="link"
                class="px-0"
              >
                Back to Login
              </UButton>
            </UFormField>

            <UFormField>
              <UButton type="submit"> Create account </UButton>
            </UFormField>
          </div>
        </div>
      </form>
    </UCard>
  </div>
</template>

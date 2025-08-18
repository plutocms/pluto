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

const { isSubmitting, login } = useAuth()

const form = ref<Form>({
  email: '',
  password: '',
})

function submitForm() {
  login(form.value)
}
</script>

<template>
  <div class="grid h-full place-items-center">
    <UCard class="w-[400px]">
      <form @submit.prevent="submitForm">
        <div class="flex flex-col gap-y-6">
          <h1 class="text-3xl font-bold">Login</h1>

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

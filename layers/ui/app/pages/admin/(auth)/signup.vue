<script setup lang="ts">
definePageMeta({
  layout: 'auth',
})

useHead({
  title: 'Sign Up',
})

const form = ref({
  email: '',
  first_name: '',
  last_name: '',
  password: '',
  confirm_password: '',
})

const isSubmitting = ref<boolean>(false)

const passwordMatch = computed(() => {
  return form.value.password === form.value.confirm_password
})

async function submitForm() {
  if (!passwordMatch.value) {
    return
  }

  isSubmitting.value = true
  try {
    await $fetch('/api/signup', {
      method: 'POST',
      body: form.value,
    })

    navigateTo('/admin/login?rel=new')
  } catch (error) {
    console.error('Error signing up:', error)
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <div class="grid h-full place-items-center">
    <UCard class="w-[400px]">
      <form @submit.prevent="submitForm">
        <div class="flex flex-col gap-y-6">
          <h1 class="text-3xl font-bold">Create Account</h1>

          <UFormField label="Email">
            <UInput
              v-model="form.email"
              type="email"
              placeholder="victor@example.com"
              class="w-full"
            />
          </UFormField>

          <div class="flex gap-x-4">
            <UFormField label="First Name">
              <UInput
                v-model="form.first_name"
                placeholder="e.g: John"
                class="w-full"
              />
            </UFormField>

            <UFormField label="Last Name">
              <UInput
                v-model="form.last_name"
                placeholder="e.g: Doe"
                class="w-full"
              />
            </UFormField>
          </div>

          <UFormField :error="!passwordMatch" label="Password">
            <UInput
              v-model="form.password"
              placeholder="••••"
              class="w-full"
              type="password"
            />
          </UFormField>

          <UFormField :error="!passwordMatch" label="Confirm Password">
            <UInput
              v-model="form.confirm_password"
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
              <UButton
                :disabled="isSubmitting || !passwordMatch"
                :loading="isSubmitting"
                type="submit"
              >
                Create account
              </UButton>
            </UFormField>
          </div>
        </div>
      </form>
    </UCard>
  </div>
</template>

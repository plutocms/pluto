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

          <UFormField>
            <UButton type="submit" size="lg"> Login </UButton>
          </UFormField>
        </div>
      </form>
    </UCard>
  </div>
</template>

<script setup lang="ts">
  definePageMeta({
    layout: 'auth',
  })

  useHead({
    title: 'Login',
  })

  const supabase = useSupabaseClient()

  const form = ref({
    email: '',
    password: '',
  })

  async function submitForm() {
    await supabase.auth.signInWithPassword({
      email: form.value.email,
      password: form.value.password,
    })

    navigateTo('/admin')
  }
</script>

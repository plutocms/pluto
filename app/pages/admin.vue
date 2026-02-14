<script setup lang="ts">
definePageMeta({
  middleware: 'auth',
  layout: 'admin',
})

const route = useRoute()
const { isLoggedIn, logout } = await useAuth()
const toast = useToast()

const visibility = useDocumentVisibility()

watch(visibility, async (current, previous) => {
  if (current === 'visible' && previous === 'hidden') {
    if (
      !isLoggedIn.value &&
      route.path.startsWith('/admin/') &&
      route.path !== '/admin/login' &&
      route.path !== '/admin/signup'
    ) {
      await logout({ redirectTo: route.path })

      toast.add({
        title: 'You are not logged in',
        description: 'Please log in to continue.',
        icon: 'lucide:circle-x',
        color: 'error',
      })
    }
  }
})
</script>

<template>
  <div class="light:text-zinc-800 h-full dark:text-white">
    <NuxtPage />
  </div>
</template>

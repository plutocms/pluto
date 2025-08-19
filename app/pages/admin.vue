<script setup lang="ts">
definePageMeta({
  middleware: 'auth',
  layout: 'admin',
})

const route = useRoute()
const { isLoggedIn } = useAuth()
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
      await navigateTo(
        `/admin/login?redirect=${encodeURIComponent(route.path)}`
      )

      toast.add({
        title: 'Session expired',
        description: 'Please log in again.',
        icon: 'lucide:circle-x',
        color: 'error',
      })
    }
  }
})
</script>

<template>
  <div class="light:text-zinc-800 h-full text-white">
    <NuxtPage />
  </div>
</template>

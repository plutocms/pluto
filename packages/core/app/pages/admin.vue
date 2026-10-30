<script setup lang="ts">
// The parent route of every /admin/** page. It sets the admin layout. A child
// that must not use it (the auth pages) sets its own layout. Core also owns
// the route guard: see app/middleware/pluto-admin-auth.global.ts.
definePageMeta({ layout: 'admin' })
</script>

<template>
  <NuxtPage />
</template>

<script setup lang="ts">
definePageMeta({
  middleware: 'auth',
  layout: 'admin',
})
</script>

<template>
  <div class="h-full">
    <NuxtPage />
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  middleware: 'auth',
  layout: 'admin',
})
</script>

<template>
  <div class="light:text-zinc-800 h-full text-white">
    <NuxtPage />
  </div>
</template>

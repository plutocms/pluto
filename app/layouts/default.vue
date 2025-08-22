<script setup lang="ts">
const { isLoggedIn } = useAuth()
</script>

<template>
  <div>
    <NavbarAdmin v-if="isLoggedIn" />

    <slot />
  </div>
</template>

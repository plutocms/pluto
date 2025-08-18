<script setup lang="ts">
const { user } = useAuth()
</script>

<template>
  <div>
    <NavbarAdmin v-if="user" />

    <slot />
  </div>
</template>

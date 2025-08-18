<script setup lang="ts">
const user = useSupabaseUser()
</script>

<template>
  <div>
    <NavbarAdmin v-if="user" />

    <slot />
  </div>
</template>

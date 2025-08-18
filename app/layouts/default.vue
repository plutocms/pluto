<script setup lang="ts">
const user = useSupabaseUser()
</script>

<template>
  <div>
    <NavbarAdmin v-if="user && user.user_metadata.is_admin" />

    <slot />
  </div>
</template>

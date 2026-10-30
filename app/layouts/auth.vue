<script setup lang="ts">
usePlutoAdminTheme()
</script>

<template>
  <PlutoAdminTheme>
    <div class="flex min-h-dvh grow flex-col bg-(--pluto-admin-canvas)">
      <slot />
    </div>
  </PlutoAdminTheme>
</template>

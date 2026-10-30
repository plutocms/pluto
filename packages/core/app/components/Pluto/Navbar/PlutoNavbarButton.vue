<script setup lang="ts">
// One look for a link action in the admin navbar. The label shows from the lg
// breakpoint. Below it, only the icon shows, and the label stays as the
// aria-label. It renders an <li>, because PlutoNavbarAdminActions sits in a <ul>.
// The link fills the height of the bar. See PlutoNavbarHit.
defineProps<{
  label: string
  icon?: string
  to: string
  target?: string
  title?: string
  disabled?: boolean
}>()
</script>

<template>
  <li class="h-full shrink-0">
    <PlutoNavbarHit
      :label="label"
      :title="title"
      :icon="icon"
      :to="to"
      :target="target"
      :disabled="disabled"
      size="sm"
    >
      <span class="hidden lg:inline">{{ label }}</span>
    </PlutoNavbarHit>
  </li>
</template>

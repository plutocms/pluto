<script setup lang="ts">
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

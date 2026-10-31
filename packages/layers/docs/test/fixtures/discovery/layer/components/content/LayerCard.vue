<script setup lang="ts">
defineProps<{ title?: string, count?: number }>()

definePlutoBlock({})
</script>

<template>
  <div>{{ title }}<slot /></div>
</template>

<script setup lang="ts">
const props = defineProps<{ text: string }>()

const parts = computed(() => plutoCodeTextParts(props.text))
</script>

<template>
  <template v-for="(part, index) in parts" :key="index">
    <code v-if="part.code">{{ part.text }}</code>
    <template v-else>{{ part.text }}</template>
  </template>
</template>

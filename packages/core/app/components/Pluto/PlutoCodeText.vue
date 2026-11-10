<script setup lang="ts">
// A text with code: the parts between backticks render as `<code>` (the admin style of
// pluto-layer.css). Use it for a translated string that names an env var, a file, a path or a
// command: "Set `NAME` in your `.env` file." No HTML in the string, so no `v-html`.
const props = defineProps<{ text: string }>()

const parts = computed(() => plutoCodeTextParts(props.text))
</script>

<template>
  <template v-for="(part, index) in parts" :key="index">
    <code v-if="part.code">{{ part.text }}</code>
    <template v-else>{{ part.text }}</template>
  </template>
</template>

<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    title?: string
    tone?: 'plain' | 'accent'
  }>(),
  { title: '', tone: 'plain' }
)

definePlutoBlock({
  label: 'Panel',
  icon: 'lucide:panel-top',
  description: 'A box with a title and any blocks inside.',
})
</script>

<template>
  <section
    :class="
      props.tone === 'accent'
        ? 'border-primary bg-primary/5'
        : 'border-default bg-elevated/40'
    "
    class="my-6 rounded-lg border p-5"
    data-panel
  >
    <h2 v-if="props.title" class="text-highlighted mb-3 text-xl font-semibold">
      {{ props.title }}
    </h2>

    <slot />
  </section>
</template>

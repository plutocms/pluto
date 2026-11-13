<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    type?: 'note' | 'tip' | 'warning'
    title?: string
    text?: string
  }>(),
  { type: 'note', title: '', text: '' }
)

definePlutoBlock({
  label: 'Callout',
  icon: 'lucide:message-square-quote',
  description: 'A note, a tip or a warning in a box.',
})

const LOOKS = {
  note: { color: 'info', icon: 'i-lucide-info' },
  tip: { color: 'success', icon: 'i-lucide-lightbulb' },
  warning: { color: 'warning', icon: 'i-lucide-triangle-alert' },
} as const

const look = computed(() => LOOKS[props.type] ?? LOOKS.note)
</script>

<template>
  <UAlert
    :title="props.title || undefined"
    :description="props.text || undefined"
    :color="look.color"
    :icon="look.icon"
    variant="subtle"
  />
</template>

<script setup lang="ts">
const props = defineProps<{
  /** `left` is the side panel left of the canvas. `right` is a tab of the right panel. */
  side: 'left' | 'right'
  /** Unique in the form. The right panel uses it as the tab value. */
  id: string
  /** The tab label (right), or the slideover title (left). */
  label?: string
  /** The tab icon (right). */
  icon?: string
}>()

const host = inject(plutoCanvasHostKey, null)

if (host) {
  const unregister = host.registerPanel(() => ({
    id: props.id,
    side: props.side,
    label: props.label,
    icon: props.icon,
  }))
  onBeforeUnmount(unregister)
}

const target = computed(() => {
  if (!host) {
    return null
  }
  return props.side === 'left'
    ? host.leftTarget.value
    : host.rightTarget(props.id)
})
</script>

<template>
  <slot v-if="!host" />

  <Teleport v-else-if="target" :to="target">
    <div :data-pluto-canvas-panel="id" class="flex min-h-0 flex-1 flex-col">
      <slot />
    </div>
  </Teleport>
</template>

<script setup lang="ts">
// A field widget of a 'canvas' form renders one of these for each panel it
// wants beside the canvas. The slot content moves (Teleport) into the left
// panel, or into one tab of the right panel. The widget stays in the canvas, so
// its state is one component tree. The widget contract does not change.
//
// Outside a 'canvas' form (no host), the slot renders inline where the panel
// sits, so a widget still works in any other layout.
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

// The target is an element ref, so it changes when the panel closes and opens,
// when the screen changes between desktop and narrow, and when a tab mounts.
// Until it exists, nothing renders, and the slot content mounts when it does.
const target = computed(() => {
  if (!host) {
    return null
  }
  return props.side === 'left' ? host.leftTarget.value : host.rightTarget(props.id)
})
</script>

<template>
  <slot v-if="!host" />

  <Teleport v-else-if="target" :to="target">
    <div :data-pluto-canvas-panel="id" class="flex min-h-0 flex-col">
      <slot />
    </div>
  </Teleport>
</template>

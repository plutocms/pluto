<script setup lang="ts">
// The "+" button of a content type item in the admin sidebar. It renders in the
// `item-trailing` slot of the item, so it knows the item. But a link cannot hold
// a button (invalid HTML). So the slot holds only an empty spacer that keeps room
// at the right end of the row. On mount, the component adds a host element right
// after the item link (a sibling, inside the same <li>) and teleports the button
// there. The button is then after its link in the tab order and does not sit in
// it. A click on the button does not reach the link.
//
// The button is always in the tab order. It is invisible until the row is hovered,
// or the link or the button has the focus. A hidden control that cannot be reached
// would need a changing `tabindex`, and keyboard users would not know it is there.
// Focus makes it show.
const props = defineProps<{
  label: string
  to: string
  /** The item has a group chevron at its right end, so the button sits left of it. */
  chevron?: boolean
}>()

const anchor = useTemplateRef<HTMLElement>('anchor')
const host = shallowRef<HTMLElement>()

onMounted(() => {
  const link = anchor.value?.closest('a, button')
  if (!link) {
    return
  }
  const el = document.createElement('div')
  // The <li> is `relative` (the menu `ui`). The row is 34 px high (py-2 and a
  // size-4.5 icon), so the host has that height and centers the button.
  el.className = [
    'absolute top-0 flex h-8.5 items-center opacity-0',
    // Show on hover or focus of the link, and on hover or focus of the button.
    '[:is(a,button):hover+&]:opacity-100 [:is(a,button):focus-visible+&]:opacity-100',
    'hover:opacity-100 focus-within:opacity-100',
    props.chevron ? 'right-9' : 'right-2.5',
  ].join(' ')
  link.after(el)
  host.value = el
})

onBeforeUnmount(() => host.value?.remove())
</script>

<template>
  <span ref="anchor" class="size-5 shrink-0" aria-hidden="true" />
  <Teleport v-if="host" :to="host">
    <UButton
      :aria-label="label"
      :title="label"
      class="cursor-pointer"
      icon="i-lucide-plus"
      color="neutral"
      variant="ghost"
      size="xs"
      square
      @click="navigateTo(to)"
    />
  </Teleport>
</template>

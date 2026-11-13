<script setup lang="ts">
// A link cannot hold a button. The button teleports to a host element right after the link.
const props = defineProps<{
  label: string
  to: string
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
  el.className = [
    'absolute top-0 flex h-8.5 items-center opacity-0',
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
    <UTooltip :text="label">
      <UButton
        :aria-label="label"
        class="cursor-pointer"
        icon="i-lucide-plus"
        color="neutral"
        variant="ghost"
        size="xs"
        square
        @click="navigateTo(to)"
      />
    </UTooltip>
  </Teleport>
</template>

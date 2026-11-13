<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import type { Editor } from '@tiptap/vue-3'

const props = defineProps<{ editor: Editor }>()

const { t, tx } = usePlutoI18n()
const { list } = usePlutoContentComponents()

const items = computed<DropdownMenuItem[][]>(() => [
  [
    { type: 'label', label: t('pluto.blocks.insert') },
    ...list.value.map((component) => ({
      label: tx(component.label),
      icon: component.icon,
      onSelect: () => {
        props.editor.chain().focus().insertPlutoComponent(component.name).run()
      },
    })),
  ],
])
</script>

<template>
  <UDropdownMenu
    :items="items"
    :content="{
      align: 'start',
      onCloseAutoFocus: (event: Event) => event.preventDefault(),
    }"
    arrow
  >
    <UTooltip :text="t('pluto.blocks.insert')">
      <UButton
        :aria-label="t('pluto.blocks.insert')"
        :disabled="!editor.isEditable"
        icon="i-lucide-puzzle"
        color="neutral"
        variant="ghost"
        size="sm"
      />
    </UTooltip>
  </UDropdownMenu>
</template>

<script setup lang="ts">
// The component button of a rich text toolbar (a `slot: 'component'` item): a menu of the block
// components of the site (`usePlutoContentComponents`). A choice puts the component at the cursor
// (`insertPlutoComponent`), and its chip opens the props form. See the content-components skill.
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
  <!-- No focus back to the button on close: the chip of the new component opens its props form,
       and a focus outside the form would close it. -->
  <UDropdownMenu
    :items="items"
    :content="{
      align: 'start',
      onCloseAutoFocus: (event: Event) => event.preventDefault(),
    }"
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

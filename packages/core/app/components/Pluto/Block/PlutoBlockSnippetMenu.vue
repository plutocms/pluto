<script setup lang="ts">
import {
  insertTextFor,
  listPaletteBlocks,
} from '#layers/pluto/shared/utils/blocks/registry'
import componentBlocks from '#pluto-blocks'

const props = defineProps<{
  insert: (text: string, options?: { block?: boolean }) => void
  disabled?: boolean
}>()

const { t, tx } = usePlutoI18n()
const blockSources = usePlutoBlockSources(componentBlocks)

const items = computed(() =>
  listPaletteBlocks(blockSources()).flatMap((group) =>
    group.items.map((definition) => ({
      label: tx(definition.label),
      icon: definition.icon,
      onSelect: () =>
        props.insert(insertTextFor(definition), { block: true }),
    }))
  )
)
</script>

<template>
  <UDropdownMenu
    :items="items"
    :content="{ align: 'start' }"
    :disabled="disabled"
  >
    <UButton
      :label="t('pluto.blocks.snippets')"
      :disabled="disabled"
      color="neutral"
      variant="ghost"
      size="xs"
      icon="i-lucide-plus"
      trailing-icon="i-lucide-chevron-down"
    />
  </UDropdownMenu>
</template>

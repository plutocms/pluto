<script setup lang="ts">
import type { CommandPaletteGroup, CommandPaletteItem } from '@nuxt/ui'
import {
  acceptedNames,
  buildPalette,
} from '#layers/pluto/shared/utils/blocks/editor'
import { groupLabelKey } from '#layers/pluto/shared/utils/blocks/labels'
import { findBlock } from '#layers/pluto/shared/utils/blocks/tree'

const editor = usePlutoBlockEditor()
const { t, tx } = usePlutoI18n()

const open = computed({
  get: () => editor.palette.value.open,
  set: (value) => {
    editor.palette.value = { ...editor.palette.value, open: value }
  },
})

const accepts = computed(() => {
  const target = editor.palette.value.target
  if (target?.parentId === undefined) {
    return undefined
  }
  const parent = editor.doc.value.blocks.length
    ? findBlockById(target.parentId)
    : undefined
  const definition = parent ? editor.definitionOf(parent) : undefined
  return definition
    ? acceptedNames(definition, target.slot ?? 'default')
    : undefined
})

function findBlockById(id: string) {
  const found = findBlock(editor.doc.value, id)
  return found?.block
}

const groups = computed<CommandPaletteGroup[]>(() =>
  buildPalette(editor.sources.value, accepts.value).map(
    ({ group, entries }) => ({
      id: group,
      label: tx(groupLabelKey(group)),
      items: entries.map((entry): CommandPaletteItem => ({
        label: tx(entry.label),
        suffix: entry.description ? tx(entry.description) : undefined,
        icon: entry.icon,
        onSelect: () => {
          editor.insert(entry, editor.palette.value.target)
          open.value = false
        },
      })),
    })
  )
)
</script>

<template>
  <UModal
    v-model:open="open"
    :title="t('pluto.blocks.editor.addBlock')"
    :description="t('pluto.blocks.editor.addBlockDescription')"
    :ui="{ content: 'pluto-palette max-w-xl', header: 'sr-only' }"
  >
    <template #content>
      <UCommandPalette
        :groups="groups"
        :placeholder="t('pluto.blocks.editor.searchBlocks')"
        :close="true"
        class="h-112 max-h-[80dvh]"
        @update:open="open = $event"
      >
        <template #empty>
          <p class="px-4 py-6 text-center text-sm text-muted">
            {{ t('pluto.blocks.editor.noBlocks') }}
          </p>
        </template>
      </UCommandPalette>
    </template>
  </UModal>
</template>

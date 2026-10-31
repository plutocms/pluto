<script setup lang="ts">
// The palette: "Add a block". A search box and the blocks in groups, each with
// an icon, a name and a one-line description. A choice inserts the block with
// friendly content and selects it. The editor state holds the open flag and
// the target, so the outline, the inspector and a shortcut can open it.
import type { CommandPaletteGroup, CommandPaletteItem } from '@nuxt/ui'
import {
  acceptedNames,
  buildPalette,
} from '../../../../../shared/utils/blocks/editor'
import { groupLabelKey } from '../../../../../shared/utils/blocks/presets'
import { findBlock } from '../../../../../shared/utils/blocks/tree'

const editor = usePlutoBlockEditor()
const { t, tx } = usePlutoI18n()

const open = computed({
  get: () => editor.palette.value.open,
  set: (value) => {
    editor.palette.value = { ...editor.palette.value, open: value }
  },
})

/** A target inside a component that takes only some children shows only those blocks. */
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
    :title="t('docs.editor.addBlock')"
    :description="t('docs.editor.addBlockDescription')"
    :ui="{ content: 'pluto-palette max-w-xl', header: 'sr-only' }"
  >
    <template #content>
      <UCommandPalette
        :groups="groups"
        :placeholder="t('docs.editor.searchBlocks')"
        :close="true"
        class="h-112 max-h-[80dvh]"
        @update:open="open = $event"
      >
        <template #empty>
          <p class="px-4 py-6 text-center text-sm text-muted">
            {{ t('docs.editor.noBlocks') }}
          </p>
        </template>
      </UCommandPalette>
    </template>
  </UModal>
</template>

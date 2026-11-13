<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'

export type PlutoMarkdownToolbarItem =
  | {
      kind: 'button'
      id: string
      icon: string
      label: string
      keys?: string[]
      disabled?: boolean
      run: () => void
    }
  | {
      kind: 'menu'
      id: string
      icon: string
      label: string
      disabled?: boolean
      items: DropdownMenuItem[] | DropdownMenuItem[][]
    }
  | { kind: 'separator'; id: string }

defineProps<{
  entry: PlutoMarkdownToolbarItem
}>()
</script>

<template>
  <USeparator
    v-if="entry.kind === 'separator'"
    orientation="vertical"
    class="mx-1 h-5 shrink-0"
    data-toolbar-separator
  />

  <UDropdownMenu
    v-else-if="entry.kind === 'menu'"
    :items="entry.items"
    :content="{ align: 'start' }"
    :disabled="entry.disabled"
    arrow
  >
    <UTooltip :text="entry.label">
      <UButton
        :aria-label="entry.label"
        :disabled="entry.disabled"
        :icon="entry.icon"
        color="neutral"
        variant="ghost"
        size="sm"
        class="shrink-0"
        square
      />
    </UTooltip>
  </UDropdownMenu>

  <UTooltip v-else :text="entry.label" :kbds="entry.keys">
    <UButton
      :aria-label="entry.label"
      :disabled="entry.disabled"
      :icon="entry.icon"
      color="neutral"
      variant="ghost"
      size="sm"
      class="shrink-0"
      square
      @click="entry.run()"
    />
  </UTooltip>
</template>

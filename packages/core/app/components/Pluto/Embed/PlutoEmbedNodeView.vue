<script setup lang="ts">
import type { NodeViewProps } from '@tiptap/vue-3'
import { NodeViewWrapper } from '@tiptap/vue-3'
import { resolveEmbed } from '#layers/pluto/shared/utils/embed'

const props = defineProps<NodeViewProps>()

const { tx } = usePlutoI18n()
const registry = usePlutoRegistry()

// Select on click, not on mousedown: mousedown starts a drag of the block.
function select() {
  const position = props.getPos()
  if (props.editor.isEditable && typeof position === 'number') {
    props.editor.chain().focus().setNodeSelection(position).run()
  }
}

const url = computed(() => String(props.node.attrs.url ?? ''))
const resolved = computed(() =>
  resolveEmbed(registry.embedProviders.list.value, url.value)
)
</script>

<template>
  <NodeViewWrapper
    :class="
      selected
        ? 'ring-primary ring-2'
        : 'ring-default hover:ring-accented ring-1'
    "
    class="pluto-embed-node my-4 overflow-hidden rounded-lg transition-shadow"
    data-drag-handle
    @click="select"
  >
    <div
      v-if="resolved"
      class="pointer-events-none select-none [&_.pluto-embed]:m-0 [&_.pluto-embed\_\_player]:rounded-none"
      inert
    >
      <component
        :is="resolved.provider.component"
        :url="url"
        :match="resolved.match"
      />
    </div>

    <div
      class="bg-elevated/60 text-muted flex items-center gap-2 px-3 py-2 text-xs"
    >
      <UIcon name="i-lucide-play" class="size-3.5 shrink-0" />
      <span v-if="resolved" class="text-highlighted shrink-0 font-medium">
        {{ tx(resolved.provider.label) }}
      </span>
      <span class="min-w-0 truncate">{{ url }}</span>
    </div>
  </NodeViewWrapper>
</template>

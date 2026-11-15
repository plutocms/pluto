<script lang="ts">
import { MarkdownDocument } from '@comark/vue'
</script>

<script setup lang="ts">
import type { MarkdownDocument as PlutoBlocksDocument } from 'comark'

/**
 * The body of an item whose body field has `widget: 'blocks'`: `<PlutoBlocks :value="item.blocks" />`.
 * It renders with the components of `components/content/`, on the server too.
 *
 * @see https://pluto.vulmix.dev/docs/build/components
 */
const props = defineProps<{
  value?: PlutoBlocksDocument | null
}>()

const render = usePlutoBlocksRender()

const document = computed(() =>
  props.value ? render.coerce(props.value) : undefined
)
</script>

<template>
  <Suspense v-if="document">
    <MarkdownDocument
      :value="document"
      :components="render.components.value"
      :components-manifest="render.manifest"
    />
  </Suspense>
</template>

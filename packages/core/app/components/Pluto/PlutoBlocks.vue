<script lang="ts">
import { MarkdownDocument } from '@comark/vue'
</script>

<script setup lang="ts">
import type { MarkdownDocument as PlutoBlocksDocument } from 'comark'

/**
 * The body of an item whose body field has `widget: 'blocks'`: `<PlutoBlocks :value="item.blocks" />`.
 * It renders with the components of `components/content/`, on the server too. The text gets the
 * `pluto-prose` styles when the site has no Prose components.
 *
 * @see https://pluto.vulmix.dev/docs/build/components
 */
const props = withDefaults(
  defineProps<{
    value?: PlutoBlocksDocument | null
    /** The root element. Default `article`. */
    tag?: string
  }>(),
  {
    tag: 'article',
  }
)

const render = usePlutoBlocksRender()

const document = computed(() =>
  props.value ? render.coerce(props.value) : undefined
)
</script>

<template>
  <component :is="tag" v-if="document" :class="render.proseClass.value">
    <Suspense>
      <MarkdownDocument
        :value="document"
        :components="render.components.value"
        :components-manifest="render.manifest"
      />
    </Suspense>
  </component>
</template>

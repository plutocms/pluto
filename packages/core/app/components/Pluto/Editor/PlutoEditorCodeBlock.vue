<script setup lang="ts">
// The code block of the Visual editor (the node view of `PlutoCodeBlock`): the code, colored by its
// language (lowlight), and a select of the language at its top right. The select shows while the
// pointer is over the block or the caret is in it. The language is the info of the fence
// (```ts) in the Markdown; a name that the list does not have stays, as its own item.
import type { NodeViewProps } from '@tiptap/vue-3'
import { NodeViewContent, NodeViewWrapper } from '@tiptap/vue-3'

const props = defineProps<NodeViewProps>()

const { t } = usePlutoI18n()

// Plain text has no language (a fence with no info). The select needs a value that is not empty.
const PLAIN = 'plaintext'

const language = computed({
  get: () => String(props.node.attrs.language || PLAIN),
  set: (value: string) =>
    props.updateAttributes({ language: value === PLAIN ? null : value }),
})

// A short name (`ts`) shows as its language and stays as written. A name that the list does not
// know is its own item.
const items = computed(() => {
  const current = language.value
  const list = [
    { label: t('pluto.github.editor.codePlain'), value: PLAIN },
    ...PLUTO_CODE_LANGUAGES.map((item) => ({
      label: item.label,
      value: item.aliases?.includes(current.toLowerCase())
        ? current
        : item.value,
    })),
  ]
  return list.some((item) => item.value === current)
    ? list
    : [...list, { label: current, value: current }]
})

// The caret is in the block: the select shows, as on hover.
const active = computed(() => {
  const position = props.getPos()
  if (typeof position !== 'number') {
    return false
  }
  const { from, to } = props.editor.state.selection
  return from >= position && to <= position + props.node.nodeSize
})
</script>

<template>
  <NodeViewWrapper class="pluto-code-block group relative">
    <pre><NodeViewContent as="code" /></pre>

    <div
      v-if="editor.isEditable"
      :class="active ? 'opacity-100' : 'opacity-0'"
      class="absolute inset-e-2 top-2 transition-opacity duration-150! group-hover:opacity-100 focus-within:opacity-100"
      contenteditable="false"
    >
      <USelectMenu
        v-model="language"
        :items="items"
        :aria-label="t('pluto.github.editor.codeLanguage')"
        :search-input="{ placeholder: t('pluto.github.editor.codeLanguage') }"
        :content="{ align: 'end' }"
        value-key="value"
        color="neutral"
        variant="soft"
        size="xs"
        class="w-36"
      />
    </div>
  </NodeViewWrapper>
</template>

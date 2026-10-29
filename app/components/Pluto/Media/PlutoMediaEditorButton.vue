<script setup lang="ts">
// The image button of a rich text toolbar (a `slot: 'image'` item). It opens
// the media picker (images only) and puts the image at the cursor, with its
// alt text. The editor keeps the image as Markdown: `![alt](url)`.
import type { Editor } from '@tiptap/vue-3'
import type { PlutoMedia } from '../../../../shared/types/media'

const props = defineProps<{ editor: Editor }>()

const { t } = usePlutoI18n()
const open = ref(false)

function insert(chosen: PlutoMedia[]) {
  const [image] = chosen
  if (!image) {
    return
  }
  props.editor
    .chain()
    .focus()
    .setImage({ src: image.url, alt: image.alt || undefined })
    .run()
}
</script>

<template>
  <UTooltip :text="t('pluto.media.editor.image')">
    <UButton
      :aria-label="t('pluto.media.editor.image')"
      :disabled="!editor.isEditable"
      icon="i-lucide-image"
      color="neutral"
      variant="ghost"
      size="sm"
      @click="open = true"
    />
  </UTooltip>
  <PlutoMediaPicker
    v-model:open="open"
    :accept="['image/*']"
    @select="insert"
  />
</template>

<script setup lang="ts">
// The picker modal: the library in select mode, with uploads. The `media`
// field and the image button of a rich text editor open it. `select` gives
// the chosen records, in the order they were chosen.
import type { PlutoMedia } from '../../../../shared/types/media'

const props = withDefaults(
  defineProps<{
    multiple?: boolean
    accept?: string[]
  }>(),
  { multiple: false, accept: undefined }
)

const emit = defineEmits<{ select: [media: PlutoMedia[]] }>()

const open = defineModel<boolean>('open', { default: false })

const { t } = usePlutoI18n()
const selected = ref<PlutoMedia[]>([])

watch(open, (value) => {
  if (value) {
    selected.value = []
  }
})

function use() {
  emit('select', selected.value)
  open.value = false
}
</script>

<template>
  <UModal
    v-model:open="open"
    :title="
      props.multiple
        ? t('pluto.media.picker.titleMultiple')
        : t('pluto.media.picker.title')
    "
    :ui="{ content: 'sm:max-w-4xl' }"
  >
    <template #body>
      <PlutoMediaLibrary
        v-model:selected="selected"
        :multiple="multiple"
        :accept="accept"
        mode="select"
      />
    </template>

    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton
          :label="t('pluto.common.cancel')"
          color="neutral"
          variant="ghost"
          @click="open = false"
        />
        <UButton
          :label="
            multiple && selected.length > 1
              ? t('pluto.media.picker.useCount', { count: selected.length })
              : t('pluto.media.picker.use')
          "
          :disabled="selected.length === 0"
          @click="use"
        />
      </div>
    </template>
  </UModal>
</template>

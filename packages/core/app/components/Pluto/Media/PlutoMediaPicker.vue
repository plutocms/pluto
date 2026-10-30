<script setup lang="ts">
// The picker modal: the library in select mode, with uploads. The `media`
// field and the image button of a rich text editor open it. `select` gives
// the chosen records, in the order they were chosen. A double-click on a file
// picks it at once (one file).
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

function unselect(id: string) {
  selected.value = selected.value.filter((entry) => entry.id !== id)
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
    :ui="{ content: 'sm:max-w-5xl' }"
  >
    <template #body>
      <PlutoMediaLibrary
        v-model:selected="selected"
        :multiple="multiple"
        :accept="accept"
        mode="select"
        @confirm="use"
      />
    </template>

    <template #footer>
      <div class="flex w-full flex-wrap items-center gap-2">
        <!-- The chosen files, in their order. A click takes one out. -->
        <ul
          v-if="multiple && selected.length"
          class="flex max-w-full gap-1.5 overflow-x-auto"
        >
          <li v-for="item in selected" :key="item.id" class="group/tile">
            <button
              :aria-label="
                t('pluto.media.picker.unselect', { name: item.name })
              "
              :title="item.name"
              type="button"
              class="block size-10 rounded-md"
              @click="unselect(item.id)"
            >
              <PlutoMediaTile :media="item" class="size-10" compact />
            </button>
          </li>
        </ul>
        <span class="flex-1" />
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

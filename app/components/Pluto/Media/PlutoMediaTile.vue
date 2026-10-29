<script setup lang="ts">
// One square of a media grid: the image, or an icon and the name for any
// other file. The library, the picker and the `media` field use it.
import type { PlutoMedia } from '../../../../shared/types/media'
import { mediaKind } from '../../../../shared/utils/media'

const props = defineProps<{
  media?: PlutoMedia
  selected?: boolean
}>()

const { t } = usePlutoI18n()

const kind = computed(() =>
  props.media ? mediaKind(props.media.mimeType) : 'file'
)

const icon = computed(
  () =>
    ({
      image: 'lucide:image',
      model: 'lucide:box',
      document: 'lucide:file-text',
      file: 'lucide:file',
    })[kind.value]
)
</script>

<template>
  <div
    :class="
      selected
        ? 'ring-primary ring-2'
        : 'ring-default group-hover/tile:ring-accented ring'
    "
    class="bg-elevated relative aspect-square overflow-hidden rounded-lg transition-shadow"
  >
    <img
      v-if="media && kind === 'image'"
      :src="media.url"
      :alt="media.alt"
      :width="media.width ?? undefined"
      :height="media.height ?? undefined"
      loading="lazy"
      decoding="async"
      class="size-full object-cover"
    />

    <div
      v-else
      class="text-muted flex size-full flex-col items-center justify-center gap-2 p-3 text-center"
    >
      <UIcon :name="media ? icon : 'lucide:file-x'" class="size-8 shrink-0" />
      <span class="line-clamp-2 text-xs break-all">
        {{ media?.name ?? t('pluto.media.field.missing') }}
      </span>
    </div>

    <span
      v-if="selected"
      class="bg-primary text-inverted absolute top-1.5 right-1.5 flex size-5 items-center justify-center rounded-full"
    >
      <UIcon name="lucide:check" class="size-3.5" />
    </span>
  </div>
</template>

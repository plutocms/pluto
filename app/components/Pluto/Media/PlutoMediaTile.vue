<script setup lang="ts">
// One square of a media grid: the image, the preview image of another file
// (a 3D model), or the icon of its kind. A kind with a `badge` ("3D", "PDF")
// marks it. The library, the picker and the `media` field use it.
// - `details`: the name and the size on hover.
// - `compact`: a small square (the list view), with no name.
import type { PlutoMedia } from '../../../../shared/types/media'

const props = defineProps<{
  media?: PlutoMedia
  selected?: boolean
  details?: boolean
  compact?: boolean
}>()

const { t, tx, locale } = usePlutoI18n()
const { kindOf } = usePlutoMediaKinds()

const kind = computed(() =>
  props.media ? kindOf(props.media.mimeType) : undefined
)

/** The image to show: the file itself, or its preview. */
const picture = computed(() => {
  if (!props.media) {
    return null
  }
  if (isMediaImage(props.media)) {
    return {
      url: props.media.url,
      width: props.media.width,
      height: props.media.height,
    }
  }
  return props.media.preview
})
</script>

<template>
  <div
    :class="[
      selected
        ? 'ring-primary ring-2'
        : 'ring-default group-hover/tile:ring-accented ring',
      compact ? 'rounded-md' : 'aspect-square rounded-lg',
    ]"
    class="bg-elevated relative overflow-hidden transition-shadow"
  >
    <img
      v-if="picture"
      :src="picture.url"
      :alt="media?.alt ?? ''"
      :width="picture.width ?? undefined"
      :height="picture.height ?? undefined"
      loading="lazy"
      decoding="async"
      class="size-full object-cover"
    />

    <div
      v-else
      class="text-muted flex size-full flex-col items-center justify-center gap-2 p-2 text-center"
    >
      <UIcon
        :name="media ? (kind?.icon ?? 'lucide:file') : 'lucide:file-x'"
        :class="compact ? 'size-5' : 'size-8'"
        class="shrink-0"
      />
      <span v-if="!compact" class="line-clamp-2 text-xs break-all">
        {{ media?.name ?? t('pluto.media.field.missing') }}
      </span>
    </div>

    <span
      v-if="kind?.badge && !compact"
      :title="tx(kind.label)"
      class="bg-inverted/80 text-inverted absolute bottom-1.5 left-1.5 rounded px-1.5 py-0.5 text-[0.625rem] font-semibold tracking-wide"
    >
      {{ kind.badge }}
    </span>

    <span
      v-if="selected && !compact"
      class="bg-primary text-inverted absolute top-1.5 right-1.5 flex size-5 items-center justify-center rounded-full"
    >
      <UIcon name="lucide:check" class="size-3.5" />
    </span>

    <div
      v-if="details && media && picture"
      class="pointer-events-none absolute inset-x-0 bottom-0 translate-y-1 bg-linear-to-t from-black/70 to-transparent px-2 pt-6 pb-1.5 text-white opacity-0 transition group-focus-within/tile:translate-y-0 group-focus-within/tile:opacity-100 group-hover/tile:translate-y-0 group-hover/tile:opacity-100"
    >
      <p class="truncate text-xs font-medium">{{ media.name }}</p>
      <p class="text-[0.625rem] text-white/80">
        {{ formatMediaSize(media.size, locale) }}
      </p>
    </div>
  </div>
</template>

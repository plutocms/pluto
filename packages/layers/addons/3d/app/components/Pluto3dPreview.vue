<script setup lang="ts">
// The thumbnail of a 3D model: its preview image (no three.js), with a 3D
// badge. With `interactive`, a click (or the button) starts the viewer in its
// place, so a page loads three.js only when someone wants to turn the model.
// See the 3d skill.
import { usePluto3dI18n } from '../composables/pluto-3d-i18n'

withDefaults(
  defineProps<{
    media?: PlutoPublicMedia | null
    /** The `sizes` of the preview image (`PlutoImage`). */
    sizes?: string
    /** A click starts the 3D viewer. */
    interactive?: boolean
    /** The viewer turns by itself once it starts. */
    autoRotate?: boolean
  }>(),
  {
    media: null,
    sizes: 'xs:100vw sm:50vw lg:600px',
    interactive: true,
    autoRotate: false,
  }
)

const { t } = usePluto3dI18n()
const live = ref(false)
</script>

<template>
  <div class="relative size-full">
    <Pluto3dViewer
      v-if="live"
      :media="media"
      :auto-rotate="autoRotate"
      class="absolute inset-0"
    />

    <template v-else>
      <PlutoImage
        v-if="media?.preview"
        :media="media"
        :sizes="sizes"
        class="size-full object-contain"
      />
      <div v-else class="text-muted flex size-full items-center justify-center">
        <UIcon name="lucide:box" class="size-12" />
      </div>

      <button
        v-if="interactive && media"
        :aria-label="t('3d.view')"
        type="button"
        class="absolute inset-0 flex items-end justify-center pb-4"
        @click="live = true"
      >
        <span
          class="bg-default/85 text-highlighted ring-default flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium shadow-sm ring backdrop-blur"
        >
          <UIcon name="lucide:rotate-3d" class="size-4" />
          {{ t('3d.view') }}
        </span>
      </button>
      <span
        v-else
        class="bg-inverted/80 text-inverted absolute bottom-2 left-2 rounded px-1.5 py-0.5 text-[0.625rem] font-semibold tracking-wide"
      >
        3D
      </span>
    </template>
  </div>
</template>

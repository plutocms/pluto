<script setup lang="ts">
import { usePluto3dI18n } from '../composables/pluto-3d-i18n'

withDefaults(
  defineProps<{
    /**
     * The media record of the model (the public API gives it).
     *
     * @see https://pluto.vulmix.dev/docs/layers/3d#show-a-model-on-a-site
     */
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
  <div class="pluto-3d-preview">
    <Pluto3dViewer
      v-if="live"
      :media="media"
      :auto-rotate="autoRotate"
      class="pluto-3d-preview__fill"
    />

    <template v-else>
      <PlutoImage
        v-if="media?.preview"
        :media="media"
        :sizes="sizes"
        class="pluto-3d-preview__image"
      />
      <div v-else class="pluto-3d-preview__empty pluto-3d-muted">
        <UIcon name="lucide:box" class="pluto-3d-icon-xl" />
      </div>

      <button
        v-if="interactive && media"
        :aria-label="t('3d.view')"
        type="button"
        class="pluto-3d-preview__fill pluto-3d-preview__button"
        @click="live = true"
      >
        <span class="pluto-3d-badge pluto-3d-badge--action">
          <UIcon name="lucide:rotate-3d" class="pluto-3d-icon" />
          {{ t('3d.view') }}
        </span>
      </button>
      <span v-else class="pluto-3d-preview__label">3D</span>
    </template>
  </div>
</template>

<style>
@layer theme, base, components, utilities;

@layer components {
  :where(.pluto-3d-preview) {
    position: relative;
    width: 100%;
    height: 100%;
  }

  /* Not in `:where()`: it must win over the root rule of Pluto3dViewer. */
  .pluto-3d-preview__fill {
    position: absolute;
    inset: 0;
  }

  :where(.pluto-3d-preview__image) {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: contain;
  }

  :where(.pluto-3d-preview__empty) {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
  }

  :where(.pluto-3d-preview__button) {
    display: flex;
    align-items: flex-end;
    justify-content: center;
    padding: 0 0 1rem;
    border: 0;
    background: none;
    color: inherit;
    font: inherit;
    cursor: pointer;
  }

  :where(.pluto-3d-preview__label) {
    position: absolute;
    inset-inline-start: 0.5rem;
    inset-block-end: 0.5rem;
  }
}
</style>

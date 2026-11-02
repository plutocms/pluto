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
  <!-- No Tailwind class, as in Pluto3dViewer. The layout is in the <style>
       below; the look of the badges is in app/assets/css/pluto-base.css. -->
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
/* The layout of the preview. It loads with the component, also without
   `@plutocms/css/base`. See Pluto3dViewer.vue. */
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

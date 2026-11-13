<script setup lang="ts">
import { usePluto3dI18n } from '../composables/pluto-3d-i18n'

const props = withDefaults(
  defineProps<{
    /**
     * The media record of the model (the public API gives it).
     *
     * @see https://pluto.vulmix.dev/docs/layers/3d#show-a-model-on-a-site
     */
    media?: PlutoPublicMedia | null
    /** A `.glb` URL, in place of a record. */
    src?: string
    /** The text alternative of the model. Default: the alt text or the name of the record. */
    alt?: string
    autoRotate?: boolean
    /** False: no drag and no zoom (a thumbnail that turns, for example). */
    interactive?: boolean
  }>(),
  {
    media: null,
    src: undefined,
    alt: undefined,
    autoRotate: false,
    interactive: true,
  }
)

const { t } = usePluto3dI18n()

const url = computed(() => props.src ?? props.media?.url ?? '')
const poster = computed(() => props.media?.preview?.url)
const label = computed(
  () => props.alt || props.media?.alt || props.media?.name || t('3d.model')
)

const root = useTemplateRef<HTMLDivElement>('root')
const canvas = useTemplateRef<HTMLCanvasElement>('canvas')
const state = ref<'loading' | 'ready' | 'error'>('loading')

let cleanup: (() => void) | undefined

async function start() {
  cleanup?.()
  cleanup = undefined
  if (!url.value || !canvas.value || !root.value) {
    state.value = 'error'
    return
  }
  state.value = 'loading'
  const [three, { OrbitControls }] = await Promise.all([
    import('../lib/pluto-3d'),
    import('three/examples/jsm/controls/OrbitControls.js'),
  ])
  const element = root.value
  const stage = three.createStage(canvas.value)
  stage.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))

  const controls = new OrbitControls(stage.camera, canvas.value)
  controls.enableDamping = true
  controls.enabled = props.interactive
  controls.autoRotate = props.autoRotate
  controls.autoRotateSpeed = 1.5

  function resize() {
    const width = Math.max(1, element.clientWidth)
    const height = Math.max(1, element.clientHeight)
    stage.renderer.setSize(width, height, false)
    stage.camera.aspect = width / height
    stage.camera.updateProjectionMatrix()
  }
  const resizer = new ResizeObserver(resize)
  resizer.observe(element)
  resize()

  const frame = () => {
    controls.update()
    stage.renderer.render(stage.scene, stage.camera)
  }
  const visibility = new IntersectionObserver(([entry]) => {
    stage.renderer.setAnimationLoop(entry?.isIntersecting ? frame : null)
  })
  visibility.observe(element)

  let disposed = false
  cleanup = () => {
    disposed = true
    visibility.disconnect()
    resizer.disconnect()
    stage.renderer.setAnimationLoop(null)
    controls.dispose()
    stage.dispose()
  }

  try {
    const model = await three.loadModel(url.value)
    if (disposed) {
      three.disposeObject(model)
      return
    }
    stage.scene.add(model)
    const width = Math.max(1, element.clientWidth)
    const height = Math.max(1, element.clientHeight)
    controls.target.copy(three.frameModel(stage.camera, model, width / height))
    controls.update()
    state.value = 'ready'
  } catch {
    if (!disposed) {
      state.value = 'error'
    }
  }
}

onMounted(start)
watch(url, () => {
  if (import.meta.client) {
    start()
  }
})
watch(
  () => [props.autoRotate, props.interactive],
  () => start()
)
onBeforeUnmount(() => cleanup?.())
</script>

<template>
  <div
    ref="root"
    :aria-label="label"
    :aria-busy="state === 'loading'"
    role="img"
    class="pluto-3d-viewer"
  >
    <img
      v-if="poster && state !== 'ready'"
      :src="poster"
      alt=""
      class="pluto-3d-viewer__poster"
    />

    <canvas
      ref="canvas"
      :style="{
        cursor: interactive ? 'grab' : 'default',
        opacity: state === 'ready' ? 1 : 0,
      }"
      class="pluto-3d-viewer__canvas"
    />

    <div
      v-if="state === 'loading'"
      class="pluto-3d-viewer__status pluto-3d-viewer__status--loading"
    >
      <span class="pluto-3d-badge">
        <UIcon
          name="lucide:loader-circle"
          class="pluto-3d-icon pluto-3d-viewer__spin"
        />
        {{ t('3d.loading') }}
      </span>
    </div>

    <div
      v-else-if="state === 'error'"
      class="pluto-3d-viewer__status pluto-3d-muted"
    >
      <UIcon v-if="!poster" name="lucide:box" class="pluto-3d-icon-lg" />
      <span class="pluto-3d-badge pluto-3d-badge--error">
        {{ t('3d.failed') }}
      </span>
    </div>

    <span
      v-else-if="interactive"
      class="pluto-3d-viewer__hint pluto-3d-badge pluto-3d-badge--hint"
    >
      <UIcon name="lucide:rotate-3d" class="pluto-3d-icon-sm" />
      {{ t('3d.hint') }}
    </span>
  </div>
</template>

<style>
@layer theme, base, components, utilities;

@layer components {
  :where(.pluto-3d-viewer) {
    position: relative;
    width: 100%;
    height: 100%;
    min-height: 10rem;
    overflow: hidden;
    touch-action: none;
  }

  :where(.pluto-3d-viewer__poster, .pluto-3d-viewer__canvas) {
    position: absolute;
    inset: 0;
    display: block;
    width: 100%;
    height: 100%;
  }

  :where(.pluto-3d-viewer__poster) {
    object-fit: contain;
  }

  :where(.pluto-3d-viewer__canvas) {
    transition: opacity 0.3s;
  }

  :where(.pluto-3d-viewer__status) {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    align-items: center;
    justify-content: center;
    padding: 1rem;
    text-align: center;
  }

  :where(.pluto-3d-viewer__status--loading) {
    pointer-events: none;
  }

  :where(.pluto-3d-viewer__hint) {
    position: absolute;
    inset-inline-end: 0.5rem;
    inset-block-end: 0.5rem;
    pointer-events: none;
  }

  :where(.pluto-3d-viewer__spin) {
    animation: pluto-3d-spin 1s linear infinite;
  }
}

@keyframes pluto-3d-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>

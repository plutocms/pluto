<script setup lang="ts">
// A 3D model on a page: drag to turn it, scroll or pinch to zoom. It takes a
// media record (the public API gives it) or a URL. The preview image of the
// record shows while three.js and the model load. Rendering stops while the
// viewer is off screen, and the GPU memory goes when it unmounts. The admin
// (the details of a file) and a site use the same component. See the 3d skill.
import { usePluto3dI18n } from '../composables/pluto-3d-i18n'

const props = withDefaults(
  defineProps<{
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

  // Render only while the viewer is on screen.
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
    class="relative size-full min-h-40 touch-none overflow-hidden"
  >
    <img
      v-if="poster && state !== 'ready'"
      :src="poster"
      alt=""
      class="absolute inset-0 size-full object-contain"
    />

    <canvas
      ref="canvas"
      :class="state === 'ready' ? 'opacity-100' : 'opacity-0'"
      :style="{ cursor: interactive ? 'grab' : 'default' }"
      class="absolute inset-0 size-full transition-opacity duration-300"
    />

    <div
      v-if="state === 'loading'"
      class="pointer-events-none absolute inset-0 flex items-center justify-center"
    >
      <span
        class="bg-default/80 text-muted flex items-center gap-2 rounded-full px-3 py-1.5 text-xs shadow-sm backdrop-blur"
      >
        <UIcon name="lucide:loader-circle" class="size-4 animate-spin" />
        {{ t('3d.loading') }}
      </span>
    </div>

    <div
      v-else-if="state === 'error'"
      class="text-muted absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-center text-sm"
    >
      <UIcon v-if="!poster" name="lucide:box" class="size-10" />
      <span class="bg-default/80 rounded-full px-3 py-1 text-xs">
        {{ t('3d.failed') }}
      </span>
    </div>

    <span
      v-else-if="interactive"
      class="bg-default/70 text-muted pointer-events-none absolute right-2 bottom-2 flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.6875rem] backdrop-blur"
    >
      <UIcon name="lucide:rotate-3d" class="size-3.5" />
      {{ t('3d.hint') }}
    </span>
  </div>
</template>

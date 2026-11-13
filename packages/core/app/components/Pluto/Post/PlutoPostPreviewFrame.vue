<script setup lang="ts">
const props = defineProps<{
  contentType: string
  item: Record<string, unknown>
  markdown: string
  gutterEnd?: boolean
}>()

const { t } = usePlutoI18n()
const router = useRouter()

const DEBOUNCE_MS = 150
const LOAD_TIMEOUT_MS = 12000

const frame = useTemplateRef<HTMLIFrameElement>('frame')
const ready = ref(false)
const timedOut = ref(false)
const frameKey = ref(0)

const src = computed(() => router.resolve(PLUTO_POST_PREVIEW_PATH).href)

function send(message: PlutoPostPreviewToFrame) {
  frame.value?.contentWindow?.postMessage(message, window.location.origin)
}

// Plain JSON only: a reactive proxy, a date or a function cannot cross `postMessage`.
function plainItem(): Record<string, unknown> {
  return JSON.parse(JSON.stringify(props.item ?? {})) as Record<string, unknown>
}

function render() {
  if (ready.value) {
    send(
      plutoPostPreviewMessage('render', {
        contentType: props.contentType,
        item: plainItem(),
        markdown: props.markdown,
      })
    )
  }
}

const renderSoon = useDebounceFn(render, DEBOUNCE_MS)
watch(() => [props.markdown, props.item], renderSoon, { deep: true })

const GUTTER_PX = 40

function sendInset() {
  if (ready.value) {
    send(
      plutoPostPreviewMessage('inset', { end: props.gutterEnd ? GUTTER_PX : 0 })
    )
  }
}
watch(() => props.gutterEnd, sendInset)

const colorMode = useColorMode()
function sendColorMode() {
  if (ready.value) {
    send(
      plutoPostPreviewMessage('color-mode', {
        mode: colorMode.value === 'dark' ? 'dark' : 'light',
      })
    )
  }
}
watch(() => colorMode.value, sendColorMode)

function onMessage(event: MessageEvent) {
  if (
    event.source !== frame.value?.contentWindow ||
    !isTrustedPlutoPostPreviewOrigin(event.origin, window.location.origin)
  ) {
    return
  }
  if (
    parsePlutoPostPreviewMessage(event.data, 'from-frame')?.type === 'ready'
  ) {
    ready.value = true
    timedOut.value = false
    sendInset()
    sendColorMode()
    render()
  }
}

let timer: ReturnType<typeof setTimeout> | undefined
function startTimer() {
  clearTimeout(timer)
  timer = setTimeout(() => {
    if (!ready.value) {
      timedOut.value = true
    }
  }, LOAD_TIMEOUT_MS)
}

function reload() {
  ready.value = false
  timedOut.value = false
  frameKey.value++
  startTimer()
}

function scrollToHeading(heading: number) {
  if (ready.value) {
    send(plutoPostPreviewMessage('scroll-to', { heading }))
  }
}

defineExpose({ scrollToHeading })

onMounted(() => {
  window.addEventListener('message', onMessage)
  startTimer()
})
onBeforeUnmount(() => {
  window.removeEventListener('message', onMessage)
  clearTimeout(timer)
})
</script>

<template>
  <div class="bg-muted group relative size-full min-h-0">
    <iframe
      ref="frame"
      :key="frameKey"
      :src="src"
      :title="t('pluto.post.previewTitle')"
      class="bg-default size-full border-0"
      loading="eager"
    />

    <div
      v-if="ready && !timedOut"
      :class="gutterEnd ? 'inset-e-13' : 'inset-e-3'"
      class="bg-elevated/90 text-muted ring-default pointer-events-none absolute top-3 flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium shadow-sm ring backdrop-blur transition-all duration-200 group-hover:opacity-0"
      aria-hidden="true"
    >
      <UIcon name="i-lucide-eye" class="size-3.5" />
      {{ t('pluto.post.previewBadge') }}
    </div>

    <div
      v-if="!ready && !timedOut"
      class="bg-default pointer-events-none absolute inset-0 flex flex-col"
      role="status"
    >
      <PlutoSkeletonCanvas />
      <div class="absolute inset-x-0 bottom-6 flex justify-center">
        <div
          class="bg-elevated text-muted ring-default flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-medium shadow-sm ring"
        >
          <UIcon name="i-lucide-loader-circle" class="size-3.5 animate-spin" />
          {{ t('pluto.post.previewLoading') }}
        </div>
      </div>
    </div>

    <div
      v-if="timedOut"
      class="bg-default absolute inset-0 flex items-center justify-center p-6"
    >
      <UEmpty
        :title="t('pluto.post.previewFailedTitle')"
        :description="t('pluto.post.previewFailed')"
        :actions="[
          {
            label: t('pluto.common.tryAgain'),
            icon: 'i-lucide-refresh-cw',
            color: 'neutral',
            variant: 'outline',
            onClick: reload,
          },
        ]"
        icon="i-lucide-triangle-alert"
        variant="naked"
      />
    </div>
  </div>
</template>

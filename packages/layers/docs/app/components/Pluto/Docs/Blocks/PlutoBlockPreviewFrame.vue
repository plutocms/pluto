<script setup lang="ts">
import type { PlutoPreviewChild } from '../../../../../shared/utils/blocks/preview-protocol'
import {
  previewSelectionId,
  toPreviewBlocks,
} from '../../../../../shared/utils/blocks/editor'
// The live preview of the page: an iframe of `/_pluto/preview` on the same
// origin. This component sends the blocks to the frame (after 150 ms of
// quiet), and tells the editor when a block is clicked or hovered in the frame.
// Both sides check the origin and the shape of every message.
import {
  isTrustedPreviewOrigin,
  parsePreviewMessage,
  PREVIEW_PATH,
  previewMessage,
} from '../../../../../shared/utils/blocks/preview-protocol'

const props = defineProps<{
  frontmatter: Record<string, unknown>
}>()

const editor = usePlutoBlockEditor()
const { t, tx } = usePlutoI18n()
const router = useRouter()

const DEBOUNCE_MS = 150
const LOAD_TIMEOUT_MS = 12000

const frame = useTemplateRef<HTMLIFrameElement>('frame')
const ready = ref(false)
const timedOut = ref(false)
const frameKey = ref(0)
const frameError = ref<string | null>(null)

const src = computed(() => router.resolve(PREVIEW_PATH).href)
// The preview marks the top-level blocks and their inner components. So the selection it shows
// is the deepest component on the path of the selected block (a text inside a card shows the card).
const shownId = computed(() =>
  previewSelectionId(editor.doc.value, editor.selectedId.value)
)
const blocks = computed(() =>
  toPreviewBlocks(editor.doc.value.blocks, editor.sources.value)
)

function send(message: ReturnType<typeof previewMessage>) {
  frame.value?.contentWindow?.postMessage(message, window.location.origin)
}

/** The inner components with a readable label. */
function translateChildren(
  children: PlutoPreviewChild[] | undefined
): PlutoPreviewChild[] | undefined {
  return children?.map((child) => ({
    ...child,
    label: child.label ? tx(child.label) : '',
    children: translateChildren(child.children),
  }))
}

/** The blocks with a readable label: the label of a component is an i18n key or a plain text. */
function messageBlocks() {
  return blocks.value.map((block) => {
    const source = editor.doc.value.blocks.find(
      (candidate) => candidate.id === block.id
    )
    return {
      ...block,
      label: block.label
        ? tx(block.label)
        : source
          ? tx(editor.describe(source).label)
          : '',
      ...(block.children
        ? { children: translateChildren(block.children) }
        : {}),
    }
  })
}

function sendRender() {
  // A nested value of the form is a reactive proxy, and `postMessage` cannot clone a proxy.
  // The front matter is YAML data, so a JSON copy is a plain copy.
  const frontmatter = JSON.parse(JSON.stringify(props.frontmatter)) as Record<
    string,
    unknown
  >
  send(
    previewMessage('render', {
      frontmatter,
      blocks: messageBlocks(),
      selectedId: shownId.value,
    })
  )
}

let timer: ReturnType<typeof setTimeout> | undefined
function scheduleRender() {
  clearTimeout(timer)
  timer = setTimeout(() => {
    if (ready.value) {
      sendRender()
    }
  }, DEBOUNCE_MS)
}

watch([blocks, () => props.frontmatter], scheduleRender, { deep: false })

// The selection comes from the outline or the panel: draw it and scroll to it.
watch(shownId, (id) => {
  if (!ready.value) {
    return
  }
  send(previewMessage('select', { id }))
  if (id && editor.selection.value?.source === 'ui') {
    send(previewMessage('scroll-to', { id }))
  }
})

function onMessage(event: MessageEvent) {
  if (
    event.source !== frame.value?.contentWindow ||
    !isTrustedPreviewOrigin(event.origin, window.location.origin)
  ) {
    return
  }
  const message = parsePreviewMessage(event.data, 'from-frame')
  if (!message) {
    return
  }
  switch (message.type) {
    case 'ready':
      ready.value = true
      timedOut.value = false
      frameError.value = null
      // The first render goes at once.
      sendRender()
      break
    case 'select':
      editor.select(message.id, 'preview')
      break
    case 'hover':
      editor.hoverId.value = message.id
      break
    case 'error':
      frameError.value = message.message
      break
  }
}

let loadTimer: ReturnType<typeof setTimeout> | undefined
function watchLoad() {
  clearTimeout(loadTimer)
  ready.value = false
  timedOut.value = false
  loadTimer = setTimeout(() => {
    if (!ready.value) {
      timedOut.value = true
    }
  }, LOAD_TIMEOUT_MS)
}

function reload() {
  frameKey.value++
  watchLoad()
}

onMounted(() => {
  window.addEventListener('message', onMessage)
  watchLoad()
})

onBeforeUnmount(() => {
  window.removeEventListener('message', onMessage)
  clearTimeout(timer)
  clearTimeout(loadTimer)
})

defineExpose({ reload })
</script>

<template>
  <div class="relative size-full min-h-0 bg-muted">
    <iframe
      ref="frame"
      :key="frameKey"
      :src="src"
      :title="t('docs.editor.previewTitle')"
      class="size-full border-0 bg-default"
      loading="eager"
    />

    <!--
      While the preview loads: the shape of a page (core's canvas skeleton) and a small status
      pill at the bottom, so the frame does not flash empty.
    -->
    <div
      v-if="!ready && !timedOut"
      class="pointer-events-none absolute inset-0 flex flex-col bg-default"
      role="status"
    >
      <PlutoSkeletonCanvas />
      <div class="absolute inset-x-0 bottom-6 flex justify-center">
        <div
          class="flex items-center gap-2 rounded-full bg-elevated px-3.5 py-1.5 text-xs font-medium text-muted shadow-sm ring ring-default"
        >
          <UIcon name="i-lucide-loader-circle" class="size-3.5 animate-spin" />
          {{ t('docs.editor.previewLoading') }}
        </div>
      </div>
    </div>

    <div
      v-if="timedOut"
      class="absolute inset-0 flex items-center justify-center bg-default p-6"
    >
      <UEmpty
        :title="t('docs.editor.previewFailedTitle')"
        :description="t('docs.editor.previewFailed')"
        :actions="[
          {
            label: t('docs.editor.previewRetry'),
            icon: 'i-lucide-refresh-cw',
            color: 'neutral',
            variant: 'outline',
            onClick: reload,
          },
        ]"
        icon="i-lucide-triangle-alert"
      />
    </div>
  </div>
</template>

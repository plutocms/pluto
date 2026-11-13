<script setup lang="ts">
import type { PlutoPreviewReference } from '../../../shared/utils/content-preview'
import {
  referenceOptionsFromItems,
  referenceOptionsToPublic,
} from '../../composables/internal/reference-options'

definePageMeta({ layout: false, plutoAdminBar: false })

const { t } = usePlutoI18n()

useHead({
  title: () => t('pluto.post.previewTitle'),
  meta: [{ name: 'robots', content: 'noindex, nofollow' }],
  style: [
    { textContent: 'a { pointer-events: none; }' },
    {
      textContent: [
        'html { scrollbar-width: thin; scrollbar-color: rgb(128 128 128 / 0.45) transparent; }',
        'html::-webkit-scrollbar { width: 10px; }',
        'html::-webkit-scrollbar-track { background: transparent; }',
        'html::-webkit-scrollbar-thumb { background: rgb(128 128 128 / 0.45); border: 3px solid transparent; border-radius: 9999px; background-clip: content-box; }',
        'html::-webkit-scrollbar-thumb:hover { background-color: rgb(128 128 128 / 0.7); }',
        'html { transition: padding-inline-end 200ms ease; }',
      ].join('\n'),
    },
  ],
})

const contentType = ref('')
const item = ref<Record<string, unknown>>({})
const html = ref('')
const rendered = ref(false)

const { byName } = usePlutoContentTypes()
const type = computed(() => byName(contentType.value))

const referenceRecords = shallowRef(
  new Map<string, ReadonlyMap<string, PlutoPreviewReference>>()
)

const media = usePlutoMedia()
const mediaRecords = shallowRef(new Map<string, PlutoMedia>())
watch(
  () => [
    ...previewMediaIds(type.value, item.value),
    ...previewReferenceMediaIds(
      type.value,
      item.value,
      referenceRecords.value,
      byName
    ),
  ],
  async (ids) => {
    const missing = ids.filter((id) => !mediaRecords.value.has(id))
    if (missing.length === 0 || !media.enabled) {
      return
    }
    try {
      const next = new Map(mediaRecords.value)
      for (const record of await media.get(missing)) {
        next.set(record.id, record)
      }
      mediaRecords.value = next
    } catch {
      // The preview shows the item without these files.
    }
  }
)

const referenceLoads = new Set<string>()
watch(
  () => previewReferenceTargets(type.value),
  (targets) => {
    for (const target of targets) {
      if (referenceLoads.has(target)) {
        continue
      }
      referenceLoads.add(target)
      $fetch<PlutoContentListResult>(`/api/_pluto/content/${target}`, {
        query: { limit: 1000 },
      })
        .then((result) => {
          const names = previewPublicFields(type.value, target)
          const raw = new Map(
            result.data.map((entry) => [String(entry.id), entry])
          )
          const entries = new Map<string, PlutoPreviewReference>()
          for (const [id, reference] of referenceOptionsToPublic(
            referenceOptionsFromItems(byName(target), result.data)
          )) {
            const extra = Object.fromEntries(
              names.map((name) => [name, raw.get(id)?.[name] ?? null])
            )
            entries.set(id, { ...reference, ...extra })
          }
          const next = new Map(referenceRecords.value)
          next.set(target, entries)
          referenceRecords.value = next
        })
        .catch(() => {
          referenceLoads.delete(target)
        })
    }
  },
  { immediate: true }
)

const preview = computed(() =>
  toPreviewItem(
    type.value,
    item.value,
    html.value,
    mediaRecords.value,
    referenceRecords.value,
    byName
  )
)

let siteHighlights = true
let highlightTimer: ReturnType<typeof setTimeout> | undefined
function highlightPreview() {
  clearTimeout(highlightTimer)
  if (!siteHighlights || !html.value.includes('<pre><code class="language-')) {
    return
  }
  highlightTimer = setTimeout(async () => {
    const plain = html.value
    try {
      const result = await $fetch<{ html: string; highlighted: boolean }>(
        `/api/_pluto/highlight/${encodeURIComponent(contentType.value)}`,
        { method: 'POST', body: { html: plain } }
      )
      siteHighlights = result.highlighted
      if (html.value === plain) {
        html.value = result.html
      }
    } catch {
      // The preview keeps the plain code.
    }
  }, 300)
}
onBeforeUnmount(() => clearTimeout(highlightTimer))

function scrollToHeading(index: number) {
  const body = document.querySelector('[data-pluto-post-body]') ?? document.body
  const heading = body.querySelectorAll('h1, h2, h3, h4, h5, h6')[index]
  heading?.scrollIntoView({ block: 'start', behavior: 'smooth' })
}

function onMessage(event: MessageEvent) {
  if (
    event.source !== window.parent ||
    !isTrustedPlutoPostPreviewOrigin(event.origin, window.location.origin)
  ) {
    return
  }
  const message = parsePlutoPostPreviewMessage(event.data, 'to-frame')
  if (message?.type === 'render') {
    contentType.value = message.contentType
    item.value = message.item
    html.value = plutoPostPreviewHtml(message.markdown)
    rendered.value = true
    highlightPreview()
  } else if (message?.type === 'scroll-to') {
    scrollToHeading(message.heading)
  } else if (message?.type === 'color-mode') {
    const root = document.documentElement
    root.classList.remove('light', 'dark')
    root.classList.add(message.mode)
    root.style.colorScheme = message.mode
  } else if (message?.type === 'inset') {
    document.documentElement.style.paddingInlineEnd = message.end
      ? `${message.end}px`
      : ''
  }
}

onMounted(() => {
  window.addEventListener('message', onMessage)
  window.parent.postMessage(
    plutoPostPreviewMessage('ready', {}),
    window.location.origin
  )
})

onBeforeUnmount(() => window.removeEventListener('message', onMessage))
</script>

<template>
  <PlutoPostPreview
    v-if="rendered"
    :content-type="contentType"
    :item="preview"
  />
</template>

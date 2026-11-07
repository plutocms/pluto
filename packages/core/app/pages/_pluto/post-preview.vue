<script setup lang="ts">
// The post preview: the post editor (`post-canvas`) shows this page in an iframe. It is
// a page of the app, outside the admin, so the site CSS and fonts apply. The editor sends
// the item and the Markdown; the page renders the Markdown to sanitized HTML in the
// browser and shows `PlutoPostPreview` (an app can override that component) with the
// item in the shape of the public API (`toPreviewItem`): the records of its media fields
// (read from the media library, the preview runs for a signed-in editor), and the dates
// as `createdAt` and `publishedAt`. Only a message from the same origin and from the
// parent window counts.
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
    // The preview is for reading the post, not for using the site: no link opens.
    { textContent: 'a { pointer-events: none; }' },
    {
      // A thin scrollbar that fits the editor, in both color modes: a gray thumb on no track.
      // The same as the page preview of the docs layer.
      textContent: [
        'html { scrollbar-width: thin; scrollbar-color: rgb(128 128 128 / 0.45) transparent; }',
        'html::-webkit-scrollbar { width: 10px; }',
        'html::-webkit-scrollbar-track { background: transparent; }',
        'html::-webkit-scrollbar-thumb { background: rgb(128 128 128 / 0.45); border: 3px solid transparent; border-radius: 9999px; background-clip: content-box; }',
        'html::-webkit-scrollbar-thumb:hover { background-color: rgb(128 128 128 / 0.7); }',
        // The `inset` message sets the padding. It moves smoothly.
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

// The items of the target types of the reference fields (tags, categories, authors), by id,
// with the raw values of their `publicFields` (an author avatar and bio). The page reads each
// target once.
const referenceRecords = shallowRef(
  new Map<string, ReadonlyMap<string, PlutoPreviewReference>>()
)

// The media records, by id: the media fields of the item, and the media `publicFields` of the
// referenced items. A record never changes, so each id is read once.
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
          // The preview shows the item without these labels.
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
  } else if (message?.type === 'scroll-to') {
    scrollToHeading(message.heading)
  } else if (message?.type === 'inset') {
    // Space at the right of the page, for the open button of the closed right panel.
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

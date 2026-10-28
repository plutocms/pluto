<script setup lang="ts">
import { renderMarkdown } from '../../../shared/markdown/render'

// The post preview: the post editor (`post-canvas`) shows this page in an iframe. It is
// a page of the app, outside the admin, so the site CSS and fonts apply. It fetches
// nothing. The editor sends the item and the Markdown; the page renders the Markdown
// to sanitized HTML in the browser and shows `PlutoPostPreview` (an app can override
// that component). Only a message from the same origin and from the parent window counts.
definePageMeta({ layout: false, plutoAdminBar: false })

const { t } = usePlutoI18n()

useHead({
  title: () => t('pluto.post.previewTitle'),
  meta: [{ name: 'robots', content: 'noindex, nofollow' }],
  // The preview is for reading the post, not for using the site: no link opens.
  style: [{ textContent: 'a { pointer-events: none; }' }],
})

const contentType = ref('')
const item = ref<Record<string, unknown>>({})
const html = ref('')
const rendered = ref(false)

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
    html.value = renderMarkdown(message.markdown)
    rendered.value = true
  } else if (message?.type === 'scroll-to') {
    scrollToHeading(message.heading)
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
    :item="item"
    :html="html"
  />
</template>

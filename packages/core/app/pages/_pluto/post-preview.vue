<script setup lang="ts">
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
  style: [
    // The preview is for reading the post, not for using the site: no link opens.
    { textContent: 'a { pointer-events: none; }' },
    {
      // A thin scrollbar that fits the editor, in both color modes: a gray thumb on no track.
      // The same as the page preview of the nuxt-content layer.
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
    :item="item"
    :html="html"
  />
</template>

<script setup lang="ts">
import PlutoHtml from '../PlutoHtml.vue'

// The default post preview of the post editor (`post-canvas`). The preview page
// (`/_pluto/post-preview`) renders it with the site CSS, so it looks like the site.
//
// An app overrides it with its own `components/PlutoPostPreview.vue` that takes the
// same props, to use its real post layout. Put `data-pluto-post-body` on the
// element that holds the body, so the outline can scroll to a heading.
const props = defineProps<{
  /** The content type name, for example `post`. */
  contentType: string
  /** The fields of the item, without the body. */
  item: Record<string, unknown>
  /** The body as sanitized HTML. */
  html: string
}>()

const { byName } = usePlutoContentTypes()

const text = (value: unknown) => (typeof value === 'string' ? value : '')
const title = computed(() =>
  text(props.item[byName(props.contentType)?.titleField ?? 'title'])
)
const excerpt = computed(() => text(props.item.excerpt))
const date = computed(() => {
  const value = text(props.item.publishedAt) || text(props.item.createdAt)
  const parsed = value ? new Date(value) : null
  return parsed && !Number.isNaN(parsed.getTime())
    ? parsed.toLocaleDateString(undefined, { dateStyle: 'long' })
    : ''
})
</script>

<template>
  <UContainer class="py-12">
    <article class="mx-auto flex max-w-3xl flex-col gap-6">
      <header class="flex flex-col gap-2">
        <h1
          v-if="title"
          class="text-highlighted text-4xl font-bold text-balance"
        >
          {{ title }}
        </h1>
        <p v-if="date" class="text-muted text-sm">{{ date }}</p>
        <p v-if="excerpt" class="text-muted text-lg">{{ excerpt }}</p>
      </header>

      <PlutoHtml :html="html" data-pluto-post-body />
    </article>
  </UContainer>
</template>

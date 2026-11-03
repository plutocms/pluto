<script setup lang="ts">
import PlutoHtml from '../PlutoHtml.vue'

// The default post preview of the post editor (`post-canvas`). The preview page
// (`/_pluto/post-preview`) renders it with the site CSS, so it looks like the site.
//
// An app overrides it with its own `components/PlutoPostPreview.vue` that takes the
// same props, to use its real post layout: `item` has the shape of the public API, so
// the component of the post page renders it as it is. Put `data-pluto-post-body` on the
// element that holds the body, so the outline can scroll to a heading.
const props = defineProps<{
  /** The content type name, for example `post`. */
  contentType: string
  /** The item in the shape of the public API, with `html`. See `toPreviewItem`. */
  item: PlutoPreviewItem
}>()

const { byName } = usePlutoContentTypes()

const text = (value: unknown) => (typeof value === 'string' ? value : '')
const title = computed(() =>
  text(props.item[byName(props.contentType)?.titleField ?? 'title'])
)
const excerpt = computed(() => text(props.item.excerpt))
const date = computed(() => {
  const value = props.item.publishedAt || props.item.createdAt
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

      <PlutoHtml :html="item.html" data-pluto-post-body />
    </article>
  </UContainer>
</template>

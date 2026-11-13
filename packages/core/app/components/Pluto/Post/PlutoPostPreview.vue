<script setup lang="ts">
import PlutoHtml from '../PlutoHtml.vue'

const props = defineProps<{
  contentType: string
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

const references = computed(() =>
  (byName(props.contentType)?.fields ?? [])
    .filter(isTargetReference)
    .map((field) => {
      const value = props.item[field.name]
      const list = (Array.isArray(value) ? value : [value]).filter(
        (entry): entry is PlutoPublicReference =>
          typeof entry === 'object' && entry !== null
      )
      return { name: field.name, label: field.label, list }
    })
    .filter((group) => group.list.length > 0)
)
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

      <footer v-if="references.length > 0" class="flex flex-col gap-2">
        <div
          v-for="group in references"
          :key="group.name"
          class="flex flex-wrap items-center gap-2"
        >
          <span class="text-muted text-sm">{{ group.label }}</span>
          <UBadge
            v-for="entry in group.list"
            :key="entry.id"
            :label="entry.label"
            color="neutral"
            variant="subtle"
          />
        </div>
      </footer>
    </article>
  </UContainer>
</template>

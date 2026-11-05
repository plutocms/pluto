<script setup lang="ts">
// The `seo-preview` widget of the SEO fields: how the page looks as a search result and as a
// social card. It stores nothing (the field is virtual). It reads the item of the form, so it
// follows what the author types. See the seo skill.
defineProps<{
  field: PlutoField
  modelValue?: unknown
  disabled?: boolean
}>()

const form = usePlutoContentForm()
const { t } = usePlutoI18n()
const site = usePlutoSite()
const media = usePlutoMedia()

const item = computed(() => form?.item.value ?? {})
const type = computed(() => form?.type.value)
const text = computed(() => plutoSeoPreviewText(item.value, type.value))

// The address of the page as it will be once published. A draft has none yet.
const url = computed(() => {
  const current = type.value
  if (!current?.previewUrl) {
    return ''
  }
  const published =
    (current.status && current.status.publishedValue) || 'published'
  const path = current.previewUrl({ ...item.value, status: published } as never)
  return path ? site.absoluteUrl(path) : ''
})

const search = computed(() =>
  plutoSeoSearchCard({
    title: text.value.title,
    description: text.value.description,
    url: url.value,
  })
)
const host = computed(() => {
  if (search.value.host) {
    return search.value.host
  }
  try {
    return new URL(site.root.value).host
  } catch {
    return ''
  }
})

// The social image is a media id in the form: get its record for the file URL.
const image = ref<PlutoMedia | null>(null)
const imageId = computed(() => plutoSeoPreviewImageId(item.value, type.value))
watch(
  imageId,
  async (id) => {
    image.value = null
    if (!id) {
      return
    }
    try {
      const [record] = await media.get([id])
      if (imageId.value === id) {
        image.value = record ?? null
      }
    } catch {
      // The preview works without the image.
    }
  },
  { immediate: true }
)
</script>

<template>
  <section v-if="form" class="space-y-4">
    <h3
      class="text-highlighted flex items-center gap-1.5 text-sm font-semibold"
    >
      <UIcon name="i-lucide-search-check" class="size-4" />
      {{ field.label }}
    </h3>

    <div class="space-y-2">
      <p class="text-muted text-xs font-medium">
        {{ t('seo.preview.search') }}
      </p>
      <div class="border-default bg-default rounded-lg border p-3">
        <p class="text-muted truncate text-xs">
          {{ host }}
          <template v-for="segment in search.segments" :key="segment">
            <span aria-hidden="true"> › </span>{{ segment }}
          </template>
        </p>
        <p class="text-primary mt-1 text-base/snug wrap-break-word">
          {{ search.title || t('seo.preview.untitled') }}
        </p>
        <p class="text-toned mt-1 text-sm wrap-break-word">
          {{ search.description || t('seo.preview.noDescription') }}
        </p>
      </div>

      <ul class="space-y-1 text-xs">
        <li :class="search.titleCount.over ? 'text-warning' : 'text-muted'">
          {{
            t('seo.preview.titleCount', {
              length: search.titleCount.length,
              max: search.titleCount.max,
            })
          }}
          <template v-if="search.titleCount.over">
            {{ t('seo.preview.cut') }}
          </template>
        </li>
        <li
          :class="search.descriptionCount.over ? 'text-warning' : 'text-muted'"
        >
          {{
            t('seo.preview.descriptionCount', {
              length: search.descriptionCount.length,
              max: search.descriptionCount.max,
            })
          }}
          <template v-if="search.descriptionCount.over">
            {{ t('seo.preview.cut') }}
          </template>
        </li>
      </ul>
      <p v-if="!url" class="text-muted text-xs">
        {{ t('seo.preview.noUrl') }}
      </p>
    </div>

    <div class="space-y-2">
      <p class="text-muted text-xs font-medium">
        {{ t('seo.preview.social') }}
      </p>
      <div class="border-default bg-default overflow-hidden rounded-lg border">
        <div
          class="bg-elevated text-muted flex aspect-[1.91/1] items-center justify-center"
        >
          <img
            v-if="image"
            :src="image.url"
            :alt="image.alt"
            class="size-full object-cover"
          />
          <span v-else class="px-3 text-center text-xs">
            {{ t('seo.preview.noImage') }}
          </span>
        </div>
        <div class="border-default space-y-0.5 border-t p-3">
          <p class="text-muted text-xs uppercase">{{ host }}</p>
          <p class="text-highlighted line-clamp-2 text-sm font-semibold">
            {{ text.title || t('seo.preview.untitled') }}
          </p>
          <p class="text-toned line-clamp-2 text-xs">
            {{ text.description }}
          </p>
        </div>
      </div>
    </div>
  </section>
</template>

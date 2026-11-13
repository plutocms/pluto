<script setup lang="ts">
import type { PlutoPublicMedia } from '../../../shared/types/media'

const props = withDefaults(
  defineProps<{
    /**
     * The media record that the public API gives, for example `post.cover`.
     * @see https://pluto.vulmix.dev/docs/build/components#plutoimage
     */
    media?: PlutoPublicMedia | null
    /** The `sizes` of `@nuxt/image`, for example `xs:100vw sm:50vw lg:400px`. Give every size a screen (`xs:`): a size with none gives a 1 px entry. */
    sizes?: string
    /** Overrides the alt text of the record. */
    alt?: string
    /** The native `loading` attribute. Default `lazy`. */
    loading?: 'lazy' | 'eager'
    /** The native `fetchpriority` attribute. Default `auto`. */
    fetchpriority?: 'high' | 'low' | 'auto'
  }>(),
  {
    media: null,
    sizes: 'xs:100vw sm:50vw lg:800px',
    alt: undefined,
    loading: 'lazy',
    fetchpriority: 'auto',
  }
)

const failed = ref(false)
watch(
  () => props.media?.url,
  () => {
    failed.value = false
  }
)

const image = computed(() => {
  const media = props.media
  if (!media) {
    return null
  }
  if (isMediaImage(media)) {
    return media
  }
  return media.preview ? { ...media.preview, alt: media.alt } : null
})
const text = computed(() => props.alt ?? image.value?.alt ?? '')

const baseURL = useRuntimeConfig().app.baseURL
const fileUrl = computed(() =>
  image.value ? withBasePath(image.value.url, baseURL) : ''
)
</script>

<template>
  <img
    v-if="image && failed"
    :src="fileUrl"
    :alt="text"
    :width="image.width ?? undefined"
    :height="image.height ?? undefined"
    :loading="loading"
    :fetchpriority="fetchpriority"
    decoding="async"
  />
  <NuxtImg
    v-else-if="image"
    :src="image.url"
    :alt="text"
    :width="image.width ?? undefined"
    :height="image.height ?? undefined"
    :sizes="sizes"
    :loading="loading"
    :fetchpriority="fetchpriority"
    decoding="async"
    @error="failed = true"
  />
</template>

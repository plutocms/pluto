<script setup lang="ts">
// An image of the media library on a public page. It takes the record that
// the public API gives (a `media` field) and lets `@nuxt/image` make the
// sizes at delivery (`sizes`, the provider of the host). The width and the
// height of the record stop the layout from moving while the image loads.
//
// When the image service cannot read the file (for example a file of the
// GitHub CMS that is in the repo but not in a deploy yet), it shows the file
// as it is. A record that is not an image shows nothing. See the media skill.
import type { PlutoPublicMedia } from '../../../shared/types/media'

const props = withDefaults(
  defineProps<{
    media?: PlutoPublicMedia | null
    /** The `sizes` of `@nuxt/image`, for example `xs:100vw sm:50vw lg:400px`. Give every size a screen (`xs:`): a size with none gives a 1 px entry. */
    sizes?: string
    /** Overrides the alt text of the record. */
    alt?: string
    loading?: 'lazy' | 'eager'
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

const image = computed(() =>
  props.media && isMediaImage(props.media) ? props.media : null
)
const text = computed(() => props.alt ?? image.value?.alt ?? '')
</script>

<template>
  <template v-if="image">
    <img
      v-if="failed"
      :src="image.url"
      :alt="text"
      :width="image.width ?? undefined"
      :height="image.height ?? undefined"
      :loading="loading"
      :fetchpriority="fetchpriority"
      decoding="async"
    />
    <NuxtImg
      v-else
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
</template>

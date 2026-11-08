<script setup lang="ts">
// The Image block of the block editor: `::pluto-figure{src="/media/…" alt="…" caption="…"}`.
// The block editor fills `src` (and the size, and the alt text while it is empty) from a file of
// the media library. The Markdown keeps the URL, so the page needs no API call. `dark` is an
// image for the dark mode. With no image yet, a dashed box says what to choose. See the
// block-editor skill ("The Image block").
const props = defineProps<{
  /** The URL of the image, for example `/media/2026/11/admin-home-k3j9a.png`. */
  src?: string
  /** The text alternative. Empty for an image that is only decoration. */
  alt?: string
  /** The caption under the image. */
  caption?: string
  /** The URL of an image for the dark mode. */
  dark?: string
  /** The size of the image in pixels, so the page does not move while it loads. */
  width?: number | string
  height?: number | string
}>()

const baseURL = useRuntimeConfig().app.baseURL

/** A site path gets the base path of the site (a site under a sub path). */
function withBase(url: string | undefined): string | undefined {
  if (!url) {
    return undefined
  }
  return url.startsWith('/') && !url.startsWith('//')
    ? `${baseURL.replace(/\/$/, '')}${url}`
    : url
}

function size(value: number | string | undefined): number | undefined {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? number : undefined
}

const light = computed(() => withBase(props.src))
const darkSrc = computed(() => withBase(props.dark))
</script>

<template>
  <figure class="my-6">
    <template v-if="light">
      <img
        :src="light"
        :alt="alt ?? ''"
        :width="size(width)"
        :height="size(height)"
        :class="{ 'dark:hidden': darkSrc }"
        loading="lazy"
        class="h-auto w-full rounded-lg ring ring-default"
      />
      <img
        v-if="darkSrc"
        :src="darkSrc"
        :alt="alt ?? ''"
        :width="size(width)"
        :height="size(height)"
        loading="lazy"
        class="hidden h-auto w-full rounded-lg ring ring-default dark:block"
      />
    </template>
    <div
      v-else
      class="flex aspect-16/10 flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-accented bg-elevated/50 p-6 text-center"
    >
      <UIcon name="i-lucide-image-plus" class="size-8 text-dimmed" />
      <p class="font-medium text-highlighted">
        {{ caption || alt || 'Image' }}
      </p>
    </div>
    <figcaption
      v-if="caption && light"
      class="mt-2 text-center text-sm text-muted"
    >
      {{ caption }}
    </figcaption>
  </figure>
</template>

<script setup lang="ts">
interface Props {
  src?: string
  alt?: string
  caption?: string
  width?: string | number
  radius?: 'none' | 'sm' | 'md' | 'lg' | 'xl' | 'full'
  align?: 'start' | 'center' | 'end'
  link?: string
  target?: '_self' | '_blank'
}

const props = withDefaults(defineProps<Props>(), {
  src: undefined,
  alt: '',
  caption: undefined,
  width: undefined,
  radius: 'none',
  align: undefined,
  link: undefined,
  target: undefined,
})

definePlutoBlock<Props>({
  label: 'Image',
  description: 'An image, with an optional caption and link.',
  icon: 'i-lucide-image',
  group: 'media',
  props: {
    src: {
      type: 'media',
      fills: { alt: 'alt' },
    },
    alt: {
      description:
        'The text alternative. Empty for an image that is only decoration.',
    },
    width: {
      description: 'A CSS length, such as 50% or 320px. Empty: the full width.',
    },
    link: {
      type: 'link',
    },
    target: {
      advanced: true,
    },
  },
})

const baseURL = useRuntimeConfig().app.baseURL

const source = computed(() => blocksUrl(props.src, baseURL))
const anchor = computed(() => blocksLink(props.link, props.target, baseURL))

const style = computed(() => ({
  width: blocksLength(props.width),
}))
</script>

<template>
  <figure
    v-if="source"
    :style="style"
    :data-align="props.align"
    :data-radius="props.radius"
    class="pluto-blocks-image"
  >
    <a v-if="anchor" v-bind="anchor">
      <img :src="source" :alt="props.alt" loading="lazy" decoding="async" />
    </a>
    <img
      v-else
      :src="source"
      :alt="props.alt"
      loading="lazy"
      decoding="async"
    />

    <figcaption v-if="props.caption">
      {{ props.caption }}
    </figcaption>
  </figure>
</template>

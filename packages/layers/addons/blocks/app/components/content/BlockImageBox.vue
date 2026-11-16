<script setup lang="ts">
interface Props {
  src?: string
  alt?: string
  title?: string
  level?: string | number
  link?: string
  target?: '_self' | '_blank'
  position?: 'top' | 'left'
  align?: 'start' | 'center' | 'end'
  radius?: 'none' | 'sm' | 'md' | 'lg' | 'xl' | 'full'
}

const props = withDefaults(defineProps<Props>(), {
  src: undefined,
  alt: '',
  title: '',
  level: 3,
  link: undefined,
  target: undefined,
  position: 'top',
  align: undefined,
  radius: 'none',
})

definePlutoBlock<Props>({
  label: 'Image box',
  description: 'An image, a title and a short text.',
  icon: 'i-lucide-image-plus',
  group: 'landing',
  insert: '::block-image-box{title="A title"}\nA short text.\n::',
  props: {
    src: {
      type: 'media',
      fills: { alt: 'alt' },
    },
    alt: {
      description:
        'The text alternative. Empty for an image that is only decoration.',
    },
    level: {
      type: 'select',
      options: ['1', '2', '3', '4', '5', '6'],
      description: 'The level of the title element, h1 to h6.',
    },
    link: {
      type: 'link',
      description: 'A link on the title.',
    },
    target: {
      advanced: true,
    },
  },
  slots: {
    default: {
      label: 'Text',
      content: 'rich',
    },
  },
})

const baseURL = useRuntimeConfig().app.baseURL

const source = computed(() => blocksUrl(props.src, baseURL))
const anchor = computed(() => blocksLink(props.link, props.target, baseURL))
const tag = computed(() => `h${blocksLevel(props.level, 3)}`)
</script>

<template>
  <div
    :data-position="props.position"
    :data-align="props.align"
    :data-radius="props.radius"
    class="pluto-blocks-image-box"
  >
    <img
      v-if="source"
      :src="source"
      :alt="props.alt"
      loading="lazy"
      decoding="async"
      class="pluto-blocks-image-box__image"
    />

    <div class="pluto-blocks-image-box__body">
      <component
        :is="tag"
        v-if="props.title"
        class="pluto-blocks-image-box__title"
      >
        <a v-if="anchor" v-bind="anchor">{{ props.title }}</a>
        <template v-else>{{ props.title }}</template>
      </component>

      <div v-if="$slots.default" class="pluto-blocks-image-box__text">
        <slot />
      </div>
    </div>
  </div>
</template>

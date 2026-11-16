<script setup lang="ts">
import { BLOCKS_LAYOUT_CHILDREN } from '../../utils/blocks-names'

interface Props {
  tag?: 'section' | 'div' | 'header' | 'footer' | 'article' | 'aside'
  anchor?: string
  bg?: string
  image?: string
  overlay?: string
  overlayOpacity?: number
  color?: string
  padding?: string
  minHeight?: string | number
  width?: 'contained' | 'full'
  maxWidth?: string | number
  align?: 'start' | 'center' | 'end'
  valign?: 'start' | 'center' | 'end'
}

const props = withDefaults(defineProps<Props>(), {
  tag: 'section',
  anchor: undefined,
  bg: undefined,
  image: undefined,
  overlay: undefined,
  overlayOpacity: 50,
  color: undefined,
  padding: 'lg',
  minHeight: undefined,
  width: 'contained',
  maxWidth: undefined,
  align: undefined,
  valign: undefined,
})

definePlutoBlock<Props>({
  label: 'Section',
  description:
    'A full-width band with a background, padding and the blocks of a page.',
  icon: 'i-lucide-panel-top',
  group: 'layout',
  insert:
    '::block-section\n:::block-columns\n::::block-column\n::::\n::::block-column\n::::\n:::\n::',
  props: {
    anchor: {
      description: 'The id of the section, for a link such as #pricing.',
      advanced: true,
    },
    bg: {
      description: 'A color token (primary, surface...) or a CSS color.',
    },
    image: {
      type: 'media',
      description: 'A background image.',
    },
    overlay: {
      description:
        'A color over the background image, for the contrast of the text.',
    },
    overlayOpacity: {
      type: 'number',
      description: 'The strength of the overlay, from 0 to 100.',
    },
    color: {
      description: 'The text color of the section.',
    },
    padding: {
      type: 'select',
      options: ['none', 'xs', 'sm', 'md', 'lg', 'xl', '2xl'],
      description: 'The space above and below the content.',
    },
    minHeight: {
      description: 'A CSS length, such as 60vh or 480px.',
    },
    maxWidth: {
      description: 'A CSS length for the content. Default 72rem.',
      advanced: true,
    },
  },
  slots: {
    default: {
      label: 'Content',
      content: 'blocks',
      accepts: BLOCKS_LAYOUT_CHILDREN,
    },
  },
})

const baseURL = useRuntimeConfig().app.baseURL

const style = computed(() => ({
  backgroundColor: blocksColor(props.bg),
  backgroundImage: blocksCssUrl(props.image, baseURL),
  color: blocksColor(props.color),
  paddingBlock: blocksSpace(props.padding),
  minHeight: blocksLength(props.minHeight),
}))

const hasOwnSurface = computed(() =>
  Boolean(props.bg || props.image || props.color)
)

const overlayColor = computed(() => {
  const color = blocksColor(props.overlay)
  if (!color) {
    return undefined
  }
  const opacity = Math.min(100, Math.max(0, Number(props.overlayOpacity) || 0))
  return `color-mix(in srgb, ${color} ${opacity}%, transparent)`
})

const innerStyle = computed(() => ({
  maxWidth: blocksLength(props.maxWidth),
}))

const overlayStyle = computed(() => ({
  backgroundColor: overlayColor.value,
}))
</script>

<template>
  <component
    :is="props.tag"
    :id="props.anchor || undefined"
    :style="style"
    :data-width="props.width"
    :data-align="props.align"
    :data-valign="props.valign"
    :data-surface="hasOwnSurface ? '' : undefined"
    class="pluto-blocks-section"
  >
    <div
      v-if="overlayColor"
      :style="overlayStyle"
      class="pluto-blocks-section__overlay"
      aria-hidden="true"
    />

    <div :style="innerStyle" class="pluto-blocks-section__inner">
      <slot />
    </div>
  </component>
</template>

<script setup lang="ts">
interface Props {
  label?: string
  link?: string
  variant?: 'solid' | 'outline' | 'link'
  size?: 'sm' | 'md' | 'lg'
  align?: 'start' | 'center' | 'end'
  color?: string
  icon?: string
  full?: boolean
  target?: '_self' | '_blank'
}

const props = withDefaults(defineProps<Props>(), {
  label: '',
  link: undefined,
  variant: 'solid',
  size: 'md',
  align: undefined,
  color: undefined,
  icon: undefined,
  full: false,
  target: undefined,
})

definePlutoBlock<Props>({
  label: 'Button',
  description: 'A button that links to a page or an address.',
  icon: 'i-lucide-mouse-pointer-click',
  group: 'landing',
  insert: '::block-button{label="Get started" link="/"}\n::',
  props: {
    label: {
      type: 'string',
    },
    variant: {
      options: ['solid', 'outline', 'link'],
    },
    size: {
      options: ['sm', 'md', 'lg'],
    },
    link: {
      type: 'link',
    },
    color: {
      description:
        'A color token (primary, accent...) or a CSS color. Default primary.',
    },
    full: {
      description: 'Fill the width of its column.',
    },
    target: {
      advanced: true,
    },
  },
})

const baseURL = useRuntimeConfig().app.baseURL

const anchor = computed(() => blocksLink(props.link, props.target, baseURL))
const tag = computed(() => (anchor.value ? 'a' : 'button'))
const attrs = computed(() => anchor.value ?? { type: 'button' })

const style = computed(() => ({
  '--pluto-blocks-button-color': blocksColor(props.color),
}))
</script>

<template>
  <div :data-align="props.align" class="pluto-blocks-button-wrap">
    <component
      :is="tag"
      v-bind="attrs"
      :style="style"
      :data-variant="props.variant"
      :data-size="props.size"
      :data-full="props.full ? '' : undefined"
      class="pluto-blocks-button"
    >
      <UIcon v-if="props.icon" :name="props.icon" aria-hidden="true" />
      {{ props.label }}
    </component>
  </div>
</template>

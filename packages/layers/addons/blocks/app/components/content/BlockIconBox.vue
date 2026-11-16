<script setup lang="ts">
interface Props {
  icon?: string
  title?: string
  level?: string | number
  link?: string
  target?: '_self' | '_blank'
  position?: 'top' | 'left'
  align?: 'start' | 'center' | 'end'
  color?: string
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl'
}

const props = withDefaults(defineProps<Props>(), {
  icon: undefined,
  title: '',
  level: 3,
  link: undefined,
  target: undefined,
  position: 'top',
  align: undefined,
  color: undefined,
  size: 'xl',
})

definePlutoBlock<Props>({
  label: 'Icon box',
  description: 'An icon, a title and a short text.',
  icon: 'i-lucide-square-star',
  group: 'landing',
  insert:
    '::block-icon-box{icon="i-lucide-zap" title="Fast"}\nA short text.\n::',
  props: {
    icon: {
      type: 'icon',
    },
    size: {
      options: ['sm', 'md', 'lg', 'xl', '2xl'],
      description: 'The size of the icon.',
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
    color: {
      description:
        'The color of the icon: a token (primary...) or a CSS color.',
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

const anchor = computed(() => blocksLink(props.link, props.target, baseURL))
const tag = computed(() => `h${blocksLevel(props.level, 3)}`)

const style = computed(() => ({
  color: blocksColor(props.color),
}))
</script>

<template>
  <div
    :data-position="props.position"
    :data-align="props.align"
    class="pluto-blocks-icon-box"
  >
    <div
      v-if="props.icon"
      :style="style"
      :data-size="props.size"
      class="pluto-blocks-icon-box__icon"
    >
      <UIcon :name="props.icon" aria-hidden="true" />
    </div>

    <div class="pluto-blocks-icon-box__body">
      <component
        :is="tag"
        v-if="props.title"
        class="pluto-blocks-icon-box__title"
      >
        <a v-if="anchor" v-bind="anchor">{{ props.title }}</a>
        <template v-else>{{ props.title }}</template>
      </component>

      <div v-if="$slots.default" class="pluto-blocks-icon-box__text">
        <slot />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  icon?: string
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl'
  color?: string
  align?: 'start' | 'center' | 'end'
  label?: string
  link?: string
  target?: '_self' | '_blank'
}

const props = withDefaults(defineProps<Props>(), {
  icon: undefined,
  size: 'lg',
  color: undefined,
  align: undefined,
  label: undefined,
  link: undefined,
  target: undefined,
})

definePlutoBlock<Props>({
  label: 'Icon',
  description: 'A single icon, with an optional link.',
  icon: 'i-lucide-star',
  group: 'media',
  props: {
    icon: {
      type: 'icon',
      default: 'i-lucide-star',
    },
    size: {
      options: ['sm', 'md', 'lg', 'xl', '2xl'],
    },
    color: {
      description: 'A color token (primary, accent...) or a CSS color.',
    },
    label: {
      description:
        'The text alternative. Empty for an icon that is only decoration.',
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

const anchor = computed(() => blocksLink(props.link, props.target, baseURL))
const name = computed(() => props.icon || 'i-lucide-star')

const style = computed(() => ({
  color: blocksColor(props.color),
}))
</script>

<template>
  <div
    :style="style"
    :data-size="props.size"
    :data-align="props.align"
    class="pluto-blocks-icon"
  >
    <a v-if="anchor" v-bind="anchor" :aria-label="props.label || undefined">
      <UIcon :name="name" :aria-hidden="props.label ? undefined : 'true'" />
    </a>
    <UIcon
      v-else
      :name="name"
      :role="props.label ? 'img' : undefined"
      :aria-label="props.label || undefined"
      :aria-hidden="props.label ? undefined : 'true'"
    />
  </div>
</template>

<script setup lang="ts">
interface Props {
  label: string
  link?: string
  target?: '_self' | '_blank'
}

const props = withDefaults(defineProps<Props>(), {
  link: undefined,
  target: undefined,
})

definePlutoBlock<Props>({
  label: 'Menu item',
  description: 'One link of a menu. Items inside it are its sub-items.',
  icon: 'i-lucide-link',
  group: 'site',
  hidden: true,
  insert: '::menu-item{label="Link" link="/"}\n::',
  props: {
    label: {
      type: 'string',
      description: 'The text of the link.',
    },
    link: {
      type: 'link',
      description: 'A page path or a URL. Empty: the item only holds sub-items.',
    },
    target: {
      type: 'select',
      options: ['_self', '_blank'],
      advanced: true,
    },
  },
  slots: {
    default: {
      label: 'Sub-items',
      content: 'blocks',
      accepts: ['menu-item'],
    },
  },
})
</script>

<template>
  <li>
    <a
      :href="props.link"
      :target="props.target"
      :rel="props.target === '_blank' ? 'noopener noreferrer' : undefined"
    >
      {{ props.label }}
    </a>

    <ul v-if="$slots.default">
      <slot />
    </ul>
  </li>
</template>

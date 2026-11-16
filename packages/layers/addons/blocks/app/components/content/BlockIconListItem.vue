<script setup lang="ts">
interface Props {
  text?: string
  icon?: string
  link?: string
  target?: '_self' | '_blank'
}

const props = withDefaults(defineProps<Props>(), {
  text: '',
  icon: undefined,
  link: undefined,
  target: undefined,
})

definePlutoBlock<Props>({
  label: 'Icon list item',
  description: 'One item of an icon list.',
  icon: 'i-lucide-list-checks',
  group: 'landing',
  props: {
    text: {
      type: 'string',
      slot: 'default',
    },
    icon: {
      type: 'icon',
      description: 'An icon for this item. Empty: the icon of the list.',
    },
    link: {
      type: 'link',
    },
    target: {
      advanced: true,
    },
  },
  slots: {
    default: {
      label: 'Text',
      content: 'inline',
    },
  },
})

const listIcon = inject<Ref<string> | undefined>(
  'pluto-blocks-icon-list',
  undefined
)
const baseURL = useRuntimeConfig().app.baseURL

const name = computed(() => props.icon || listIcon?.value || 'i-lucide-check')
const anchor = computed(() => blocksLink(props.link, props.target, baseURL))
</script>

<template>
  <li class="pluto-blocks-icon-list-item">
    <UIcon :name="name" aria-hidden="true" />

    <span>
      <a v-if="anchor" v-bind="anchor">
        <BlockInline
          ><slot>{{ props.text }}</slot></BlockInline
        >
      </a>
      <BlockInline v-else
        ><slot>{{ props.text }}</slot></BlockInline
      >
    </span>
  </li>
</template>

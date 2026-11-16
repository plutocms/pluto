<script setup lang="ts">
interface Props {
  network?:
    | 'facebook'
    | 'instagram'
    | 'linkedin'
    | 'twitter'
    | 'youtube'
    | 'github'
    | 'gitlab'
    | 'twitch'
    | 'dribbble'
    | 'figma'
    | 'slack'
    | 'telegram'
    | 'email'
    | 'phone'
    | 'rss'
    | 'website'
  url?: string
  label?: string
  icon?: string
}

const props = withDefaults(defineProps<Props>(), {
  network: 'website',
  url: undefined,
  label: undefined,
  icon: undefined,
})

definePlutoBlock<Props>({
  label: 'Social link',
  description: 'One link to a social network.',
  icon: 'i-lucide-share-2',
  group: 'landing',
  props: {
    url: {
      type: 'link',
    },
    label: {
      description:
        'The name for a screen reader. Empty: the name of the network.',
    },
    icon: {
      type: 'icon',
      description: 'An icon of your own. Empty: the icon of the network.',
      advanced: true,
    },
  },
})

const baseURL = useRuntimeConfig().app.baseURL

const known = computed(
  () => BLOCKS_NETWORKS[props.network] ?? BLOCKS_NETWORKS.website!
)
const href = computed(() => blocksUrl(props.url, baseURL))
</script>

<template>
  <li class="pluto-blocks-social-link">
    <a
      v-if="href"
      :href="href"
      :aria-label="props.label || known.label"
      rel="noopener noreferrer"
    >
      <UIcon :name="props.icon || known.icon" aria-hidden="true" />
    </a>
  </li>
</template>

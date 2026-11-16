<script setup lang="ts">
import { resolveEmbed } from '#layers/pluto/shared/utils/embed'

interface Props {
  url?: string
  title?: string
  ratio?: '16:9' | '4:3' | '1:1' | '21:9' | '9:16'
  width?: string | number
  align?: 'start' | 'center' | 'end'
}

const props = withDefaults(defineProps<Props>(), {
  url: undefined,
  title: undefined,
  ratio: '16:9',
  width: undefined,
  align: undefined,
})

definePlutoBlock<Props>({
  label: 'Video',
  description: 'A video from a link, such as YouTube or Vimeo.',
  icon: 'i-lucide-play',
  group: 'media',
  insert:
    '::block-video{url="https://www.youtube.com/watch?v=jNQXAC9IVRw"}\n::',
  props: {
    url: {
      type: 'link',
      description: 'The address of the video page.',
    },
    title: {
      description: 'The name of the video, for people who use a screen reader.',
    },
    width: {
      description: 'A CSS length, such as 80% or 640px. Empty: the full width.',
    },
  },
})

const registry = usePlutoRegistry()
const baseURL = useRuntimeConfig().app.baseURL

const href = computed(() => blocksUrl(props.url, baseURL))
const resolved = computed(() =>
  href.value
    ? resolveEmbed(registry.embedProviders.list.value, href.value)
    : null
)
const ratio = computed(() => props.ratio.replace(':', ' / '))

const style = computed(() => ({
  width: blocksLength(props.width),
}))
</script>

<template>
  <figure
    v-if="href"
    :style="style"
    :aria-label="props.title || undefined"
    :data-align="props.align"
    class="pluto-blocks-video"
  >
    <div :style="{ aspectRatio: ratio }" class="pluto-blocks-video__frame">
      <component
        :is="resolved.provider.component"
        v-if="resolved"
        :url="href"
        :match="resolved.match"
      />
      <a v-else :href="href" rel="noopener noreferrer">
        {{ props.title || href }}
      </a>
    </div>
  </figure>
</template>

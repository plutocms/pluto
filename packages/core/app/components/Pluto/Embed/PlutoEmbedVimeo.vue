<script setup lang="ts">
import PlutoEmbedPlay from './PlutoEmbedPlay.vue'

const props = defineProps<{
  url: string
  match: Record<string, string>
}>()

const videoUrl = computed(() =>
  props.match.hash
    ? `https://vimeo.com/${props.match.id}/${props.match.hash}`
    : undefined
)
</script>

<template>
  <figure class="pluto-embed">
    <ScriptVimeoPlayer
      :id="Number(match.id)"
      :url="videoUrl"
      :vimeo-options="{ dnt: true, autoplay: true }"
      :root-attrs="{ class: 'pluto-embed__player' }"
      placeholder-object-fit="cover"
    >
      <template #awaitingLoad>
        <PlutoEmbedPlay />
      </template>
    </ScriptVimeoPlayer>
  </figure>
</template>

<script setup lang="ts">
// The Vimeo embed of core: a thumbnail with a play button, and the Vimeo player after a click
// (`ScriptVimeoPlayer` of @nuxt/scripts), with Do Not Track (`dnt`). An unlisted video keeps its
// hash. `match` comes from `matchVimeoUrl`.
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

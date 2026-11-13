<script setup lang="ts">
import PlutoEmbedPlay from './PlutoEmbedPlay.vue'

const props = defineProps<{
  url: string
  match: Record<string, string>
}>()

const playerVars = computed(() => ({
  autoplay: 1,
  playsinline: 1,
  ...(props.match.start && { start: Number(props.match.start) }),
}))
</script>

<template>
  <figure class="pluto-embed">
    <ScriptYouTubePlayer
      :video-id="match.id!"
      :player-vars="playerVars"
      :root-attrs="{ class: 'pluto-embed__player' }"
    >
      <template #awaitingLoad>
        <PlutoEmbedPlay />
      </template>
    </ScriptYouTubePlayer>
  </figure>
</template>

<style>
.pluto-embed {
  margin-inline: 0;
}

.pluto-embed__player {
  overflow: hidden;
  border-radius: var(--pluto-prose-radius, 0.375rem);
}

.pluto-embed__player img,
.pluto-embed__player iframe {
  display: block;
  width: 100%;
  height: 100%;
  border: 0;
}
</style>

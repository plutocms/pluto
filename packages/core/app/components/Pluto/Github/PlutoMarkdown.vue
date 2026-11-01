<script setup lang="ts">
import PlutoHtml from '../PlutoHtml.vue'

// The Git CMS name of `PlutoHtml`, kept for existing apps. New code uses `PlutoHtml`, which
// works with every backend. Attributes (for example `data-pluto-post-body`) pass through.
withDefaults(
  defineProps<{
    html: string
    tag?: string
    class?: any
  }>(),
  {
    tag: 'article',
    class: undefined,
  }
)
</script>

<template>
  <PlutoHtml :html="html" :tag="tag" :class="$props.class" />
</template>

<script setup lang="ts">
// Shows the `html` of a public item (the public API of Pluto), with readable prose styles. It
// works with every backend: the Git CMS and `@plutocms/supabase-blog` both send the body as
// sanitized HTML, so the string is safe to set as `innerHTML`. This component never parses or
// sanitizes. Do not pass any other HTML to it.
//
// The prose look is `.pluto-prose` in app/assets/css/pluto-base.css: plain CSS that a site
// imports with `@plutocms/css/base`. No Tailwind class here, so the component works on a site
// with no Tailwind. See the public-components skill.
//
// A site under a sub path (a project site of GitHub Pages) gets its base path before each site
// path of the body (`withBaseInHtml`), so the images and the links of a post still work.
const props = withDefaults(
  defineProps<{
    html: string
    tag?: string
  }>(),
  {
    tag: 'article',
  }
)

const baseURL = useRuntimeConfig().app.baseURL
const body = computed(() => withBaseInHtml(props.html, baseURL))
</script>

<template>
  <!-- `innerHTML` is bound as a plain camelCase prop, not `v-html`. A `v-html`
       on a dynamic `<component :is>` drops the value in the SSR output. The
       hyphenated spelling renders a literal `inner-h-t-m-l` attribute. -->
  <!-- eslint-disable-next-line vue/attribute-hyphenation -- must stay camelCase, see comment above -->
  <component :is="tag" v-if="html" :innerHTML="body" class="pluto-prose" />
</template>

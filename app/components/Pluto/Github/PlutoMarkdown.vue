<script setup lang="ts">
import { tv } from '@nuxt/ui/utils/tv'
import theme from '#build/ui/editor'

// Shows the `html` of a public CMS item. The CMS server renders the Markdown
// and sanitizes it (see `modules/pluto-github/runtime/server/utils/sanitize-html.ts`),
// so the string is safe to set as `innerHTML`. This component never parses
// Markdown. Do not pass any other HTML to it.
const props = withDefaults(defineProps<{
  html: string
  tag?: string
  class?: any
}>(), {
  tag: 'article',
  class: undefined,
})

// The base of the Nuxt UI editor theme gives readable prose with semantic
// color tokens. The editor adds side padding, so `sm:px-0` removes it.
// The table classes are here because the editor theme has none.
const ui = computed(() => tv({ extend: theme })())

const classes = computed(() => [
  ui.value.base({ class: 'sm:px-0' }),
  '[&_table]:block [&_table]:w-full [&_table]:overflow-x-auto [&_table]:text-sm',
  '[&_:is(th,td)]:border [&_:is(th,td)]:border-default [&_:is(th,td)]:px-3 [&_:is(th,td)]:py-2',
  '[&_th]:bg-elevated [&_th]:text-highlighted [&_th]:text-start [&_th]:font-semibold',
  '[&_input[type=checkbox]]:me-2',
  props.class,
])
</script>

<template>
  <!-- `innerHTML` is bound as a plain camelCase prop, not `v-html`. A `v-html`
       on a dynamic `<component :is>` drops the value in the SSR output. The
       hyphenated spelling renders a literal `inner-h-t-m-l` attribute. The
       same note is in `PlutoProse` of `@plutocms/supabase-blog`. -->
  <!-- eslint-disable-next-line vue/attribute-hyphenation -- must stay camelCase, see comment above -->
  <component :is="tag" v-if="html" :class="classes" :innerHTML="html" />
</template>

<script lang="ts">
import type { Component } from 'vue'
import { blockKey } from '#layers/pluto/shared/utils/blocks/definition'
import blockComponents from '#pluto-block-components'

// One async component per name for the whole app, so a new render reuses the loaded one.
const loaded = new Map<string, Component | null>()

/** The component of a content component name, or `null` when no block component has that name. */
function contentComponent(name: string): Component | null {
  const key = blockKey(name)
  if (!loaded.has(key)) {
    const loader = blockComponents[key]
    loaded.set(key, loader ? defineAsyncComponent(loader) : null)
  }
  return loaded.get(key) ?? null
}
</script>

<script setup lang="ts">
// Shows the `html` of a public item (the public API of Pluto), with readable prose styles. It
// works with every backend: the Git CMS and `@plutocms/supabase-blog` both send the body as
// sanitized HTML, so the string is safe to set as `innerHTML`. This component never sanitizes.
// Do not pass any other HTML to it.
//
// The prose look is `.pluto-prose` in app/assets/css/pluto-base.css: plain CSS that a site
// imports with `@plutocms/css/base`. No Tailwind class here, so the component works on a site
// with no Tailwind. See the public-components skill.
//
// A site under a sub path (a project site of GitHub Pages) gets its base path before each site
// path of the body (`withBaseInHtml`), so the images and the links of a post still work.
//
// Embeds: a paragraph that is one URL alone has `data-pluto-embed`. When the body has one, the
// top-level elements render one by one (each keeps its inner HTML), and such a paragraph becomes
// the component of the first embed provider that matches its URL (`embedProviders` of the
// registry). With no provider, it stays the link. The top level stays flat for `.pluto-prose`.
// See the content-model skill ("Embeds").
//
// Content components: the mark of a component (`div[data-pluto-component]`) becomes the component
// of the site with that name and its props, when the component calls `definePlutoBlock`
// (`#pluto-block-components`). Another name renders nothing. See the content-components skill.
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

const registry = usePlutoRegistry()
const providers = computed(() => registry.embedProviders.list.value)

const parts = computed(() => {
  const embeds = hasEmbedParagraph(body.value) && providers.value.length > 0
  if (!embeds && !hasComponentMarker(body.value)) {
    return null
  }
  return splitBodyHtml(body.value).map((part) =>
    part.kind === 'embed'
      ? { ...part, resolved: resolveEmbed(providers.value, part.href) }
      : part.kind === 'component'
        ? { ...part, component: contentComponent(part.name) }
        : part
  )
})
</script>

<template>
  <!-- `innerHTML` is bound as a plain camelCase prop, not `v-html`. A `v-html`
       on a dynamic `<component :is>` drops the value in the SSR output. The
       hyphenated spelling renders a literal `inner-h-t-m-l` attribute. -->
  <!-- eslint-disable vue/attribute-hyphenation -- must stay camelCase, see comment above -->
  <component :is="tag" v-if="html && parts" class="pluto-prose">
    <template v-for="(part, index) in parts" :key="index">
      <component
        :is="part.resolved.provider.component"
        v-if="part.kind === 'embed' && part.resolved"
        :url="part.href"
        :match="part.resolved.match"
        :data-pluto-embed="part.resolved.provider.id"
      />
      <p v-else-if="part.kind === 'embed'" :innerHTML="part.inner" />
      <template v-else-if="part.kind === 'component'">
        <component
          :is="part.component"
          v-if="part.component"
          v-bind="part.props"
          :data-pluto-component="part.name"
        />
      </template>
      <template v-else-if="part.kind === 'text'">{{ part.text }}</template>
      <component
        :is="part.tag"
        v-else
        v-bind="part.attrs"
        :innerHTML="part.inner"
      />
    </template>
  </component>
  <component :is="tag" v-else-if="html" :innerHTML="body" class="pluto-prose" />
  <!-- eslint-enable vue/attribute-hyphenation -->
</template>

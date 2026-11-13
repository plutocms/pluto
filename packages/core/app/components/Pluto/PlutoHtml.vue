<script lang="ts">
import type { Component } from 'vue'
import { blockKey } from '#layers/pluto/shared/utils/blocks/definition'
import blockComponents from '#pluto-block-components'

const loaded = new Map<string, Component | null>()

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
// This component never sanitizes. Pass sanitized HTML only.
const props = withDefaults(
  defineProps<{
    /**
     * The sanitized HTML of a public item, for example `post.html`.
     * @see https://pluto.vulmix.dev/docs/build/components#plutohtml
     */
    html: string
    /** The root element. Default `article`. */
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
  <!-- Plain camelCase prop, not `v-html`: `v-html` on a dynamic component drops the value in SSR. -->
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

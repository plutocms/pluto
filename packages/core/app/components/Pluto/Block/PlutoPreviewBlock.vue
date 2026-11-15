<script lang="ts">
import type { Component } from 'vue'
import { MarkdownDocument } from '@comark/vue'
import { pascalCase } from 'comark/utils'
import { blockKey } from '#layers/pluto/shared/utils/blocks/definition'
import previewComponents from '#pluto-preview-components'
</script>

<script setup lang="ts">
import type { MarkdownDocument as PlutoPreviewDocument } from 'comark'

const props = defineProps<{
  id: string
  body?: PlutoPreviewDocument
  label: string
  error?: string
}>()

const emit = defineEmits<{
  error: [id: string, message: string]
}>()

const PROSE_TAGS = [
  'p',
  'a',
  'blockquote',
  'code',
  'pre',
  'em',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'hr',
  'img',
  'ul',
  'ol',
  'li',
  'strong',
  'table',
  'thead',
  'tbody',
  'td',
  'th',
  'tr',
  'script',
]

function componentManifest(tag: string) {
  return previewComponents[blockKey(tag)]?.()
}

const { t } = usePlutoI18n()

const failed = ref<string | null>(null)
const renderOptions = inject(plutoPreviewRenderKey, {})
const vueApp = useNuxtApp().vueApp

const components = computed(() => {
  const options = toValue(renderOptions)
  const map: Record<string, Component | string> = {}
  for (const [tag, name] of Object.entries(options.components ?? {})) {
    const component = vueApp.component(pascalCase(name))
    if (component) {
      map[tag] = component
    }
  }
  if (options.prose === false) {
    for (const tag of PROSE_TAGS) {
      if (!(tag in map)) {
        map[`Prose${pascalCase(tag)}`] = tag
      }
    }
  }
  return map
})

watch(
  () => props.body,
  () => {
    failed.value = null
  }
)

onErrorCaptured((error) => {
  failed.value = error instanceof Error ? error.message : String(error)
  emit('error', props.id, failed.value)
  return false
})

const note = computed(() => {
  if (props.error) {
    return t('pluto.blocks.preview.parseError')
  }
  if (failed.value) {
    return t('pluto.blocks.preview.blockError')
  }
  return t('pluto.blocks.preview.notShown')
})
</script>

<template>
  <Suspense v-if="body && !failed && !error">
    <MarkdownDocument
      :value="body"
      :components="components"
      :components-manifest="componentManifest"
    />
  </Suspense>

  <div
    v-else
    :data-pluto-block="id"
    class="my-4 flex items-center gap-3 rounded-lg border border-dashed border-default bg-elevated/50 px-4 py-3 text-sm text-muted"
  >
    <UIcon name="i-lucide-eye-off" class="size-5 shrink-0" />
    <div class="min-w-0">
      <p class="font-medium text-default">
        {{ label }}
      </p>
      <p>{{ note }}</p>
    </div>
  </div>
</template>

<script lang="ts">
import { MarkdownDocument } from '@comark/vue'
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

const { t } = usePlutoI18n()

const failed = ref<string | null>(null)
const render = usePlutoBlocksRender(inject(plutoPreviewRenderKey, {}))

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
      :components="render.components.value"
      :components-manifest="render.manifest"
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

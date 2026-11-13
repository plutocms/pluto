<script setup lang="ts">
import type { MDCRoot } from '@nuxtjs/mdc'

const props = defineProps<{
  id: string
  /** The parsed body, or `undefined` for a block that the preview does not render. */
  body?: MDCRoot
  /** The name of the block, for the card. */
  label: string
  /** A parse error of this block. */
  error?: string
}>()

const emit = defineEmits<{
  error: [id: string, message: string]
}>()

const { t } = usePlutoI18n()

const failed = ref<string | null>(null)
const value = computed(() => (props.body ? { body: props.body } : undefined))

const renderOptions = inject(plutoPreviewRenderKey, {})
const prose = computed(() => toValue(renderOptions).prose ?? true)
const components = computed(() => toValue(renderOptions).components ?? {})

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
    return t('docs.preview.parseError')
  }
  if (failed.value) {
    return t('docs.preview.blockError')
  }
  return t('docs.preview.notShown')
})
</script>

<template>
  <ContentRenderer
    v-if="value && !failed && !error"
    :value="value"
    :tag="false as unknown as string"
    :prose="prose"
    :components="components"
  />

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

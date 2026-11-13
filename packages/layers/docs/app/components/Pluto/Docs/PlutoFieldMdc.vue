<script setup lang="ts">
import { defineAsyncComponent } from 'vue'
import PlutoMdcInsertMenu from './PlutoMdcInsertMenu.vue'

const props = defineProps<{
  field: PlutoTextField
  modelValue: unknown
  disabled?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const loadingComponent = () =>
  h('div', { class: 'flex h-full flex-col gap-3 p-6' }, [
    h(resolveComponent('USkeleton'), { class: 'h-8 w-1/3' }),
    h(resolveComponent('USkeleton'), { class: 'h-64 w-full' }),
  ])
const PlutoBlockEditor = defineAsyncComponent({
  loader: () => import('./Blocks/PlutoBlockEditor.vue'),
  loadingComponent,
  delay: 120,
})
const PlutoBlockMarkdownSplit = defineAsyncComponent({
  loader: () => import('./Blocks/PlutoBlockMarkdownSplit.vue'),
  loadingComponent,
  delay: 120,
})

const { t } = usePlutoI18n()
const form = usePlutoContentForm()

const value = computed(() =>
  typeof props.modelValue === 'string' ? props.modelValue : ''
)

const canVisual = computed(() => Boolean(form?.canvas.value))

type Mode = 'visual' | 'markdown'
const saved = useCookie<Mode | null>('pluto-mdc-editor-mode', {
  default: () => null,
  maxAge: 60 * 60 * 24 * 365,
  sameSite: 'lax',
})
const mode = ref<Mode>(
  canVisual.value
    ? (saved.value ?? (props.field.editor === 'source' ? 'markdown' : 'visual'))
    : 'markdown'
)

function setMode(next: Mode) {
  mode.value = next
  saved.value = next
}
</script>

<template>
  <PlutoBlockEditor
    v-if="mode === 'visual' && canVisual"
    :model-value="value"
    :disabled="disabled"
    :mode="mode"
    @update:model-value="emit('update:modelValue', $event)"
    @update:mode="setMode"
  />

  <PlutoBlockMarkdownSplit
    v-else-if="canVisual"
    :model-value="value"
    :disabled="disabled"
    :mode="mode"
    :placeholder="field.placeholder ?? t('docs.mdc.placeholder')"
    :label="field.label"
    @update:model-value="emit('update:modelValue', $event)"
    @update:mode="setMode"
  />

  <UFormField
    v-else
    :label="field.label"
    :description="field.description"
    :required="field.required"
  >
    <LazyPlutoMarkdownCodeEditor
      :model-value="value"
      :disabled="disabled"
      :placeholder="field.placeholder ?? t('docs.mdc.placeholder')"
      :aria-label="field.label"
      @update:model-value="emit('update:modelValue', $event)"
    >
      <template #toolbar="{ insert }">
        <PlutoMdcInsertMenu :insert="insert" :disabled="disabled" />
      </template>
    </LazyPlutoMarkdownCodeEditor>
  </UFormField>
</template>

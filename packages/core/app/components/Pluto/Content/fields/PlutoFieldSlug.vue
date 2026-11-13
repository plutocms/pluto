<script setup lang="ts">
const props = defineProps<{
  field: PlutoSlugField
  modelValue: unknown
  disabled?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const { t } = usePlutoI18n()

const value = computed(() => (props.modelValue as string | undefined) ?? '')

const editing = ref(false)
const input = useTemplateRef<{ inputRef?: HTMLInputElement | null }>('input')

async function edit() {
  editing.value = true
  await nextTick()
  input.value?.inputRef?.focus()
  input.value?.inputRef?.select()
}

function done() {
  editing.value = false
}
</script>

<template>
  <UFormField
    :label="field.label"
    :description="field.description"
    :required="field.required"
  >
    <div v-if="editing" class="flex items-center gap-1">
      <UInput
        ref="input"
        :model-value="value"
        :disabled="disabled"
        class="w-full"
        autocomplete="off"
        spellcheck="false"
        @update:model-value="emit('update:modelValue', $event)"
        @keydown.enter.prevent="done"
        @keydown.esc.prevent="done"
      />
      <UTooltip :text="t('pluto.form.slugDone')">
        <UButton
          :aria-label="t('pluto.form.slugDone')"
          icon="lucide:check"
          color="neutral"
          variant="ghost"
          square
          @click="done"
        />
      </UTooltip>
    </div>

    <div v-else class="flex min-w-0 items-center gap-1">
      <p class="min-w-0 flex-1 truncate text-sm">
        <span class="text-muted">{{ field.preview }}</span>
        <span v-if="value" class="text-highlighted">{{ value }}</span>
        <span v-else class="text-dimmed italic">
          {{ t('pluto.form.slugFromTitle') }}
        </span>
      </p>
      <UTooltip v-if="!disabled" :text="t('pluto.form.slugEdit')">
        <UButton
          :aria-label="t('pluto.form.slugEdit')"
          icon="lucide:pencil"
          color="neutral"
          variant="ghost"
          size="sm"
          square
          @click="edit"
        />
      </UTooltip>
    </div>
  </UFormField>
</template>

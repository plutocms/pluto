<script setup lang="ts">
// The title of the post editor: a large, bold field above the text, with no label, no border and
// no background. The placeholder says "Add a title". A long title wraps (the field grows). Enter
// does not add a line: it goes to the text (`next`). The canvas widget (`PlutoFieldPostCanvas`)
// shows it for the `titleField` of the type, and takes that field out of the right panel.
defineProps<{
  modelValue: string
  /** The accessible name: the label of the field. */
  label: string
  /** The validation message of the last save. */
  error?: string
  disabled?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  /** Enter: the author goes on to the text. */
  next: []
}>()

const { t } = usePlutoI18n()
</script>

<template>
  <div class="flex flex-col gap-1">
    <!-- The text size is set for `md` too: the size of the textarea sets `md:text-sm`. -->
    <UTextarea
      :model-value="modelValue"
      :placeholder="t('pluto.post.titlePlaceholder')"
      :aria-label="label"
      :aria-invalid="error ? true : undefined"
      :disabled="disabled"
      :rows="1"
      :ui="{
        root: 'w-full',
        base: 'resize-none p-0 text-3xl/tight font-bold text-highlighted placeholder:text-dimmed sm:px-0 md:text-3xl/tight',
      }"
      variant="none"
      autoresize
      @update:model-value="emit('update:modelValue', String($event ?? ''))"
      @keydown.enter.prevent="emit('next')"
    />
    <p v-if="error" class="text-error text-sm" role="alert">
      {{ error }}
    </p>
  </div>
</template>

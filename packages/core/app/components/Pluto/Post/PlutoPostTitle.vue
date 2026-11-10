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
    <div class="group relative flex flex-col">
      <!-- A hint that the title is a field: a pencil in the gutter at the left (where the block
         buttons of the editor show), on hover only. It hides while the title has the focus. -->
      <UIcon
        name="i-lucide-pencil"
        class="text-dimmed pointer-events-none absolute -inset-s-9 top-3.5 size-4 opacity-0 transition-opacity group-focus-within:opacity-0! group-hover:opacity-100"
        aria-hidden="true"
      />
      <!-- The text size is set for `md` too: the size of the textarea sets `md:text-sm`. A soft
         background on hover and on focus; the negative margin keeps the text in line with the
         toolbar. -->
      <UTextarea
        :model-value="modelValue"
        :placeholder="t('pluto.post.titlePlaceholder')"
        :aria-label="label"
        :aria-invalid="error ? true : undefined"
        :disabled="disabled"
        :rows="1"
        :ui="{
          root: '-mx-2',
          base: 'cursor-pointer resize-none rounded-md px-2 py-1 text-3xl/tight font-bold text-highlighted opacity-70 transition placeholder:text-dimmed hover:opacity-100 focus:cursor-text focus:bg-elevated/60 focus:opacity-100 sm:px-2 md:text-3xl/tight',
        }"
        variant="none"
        autoresize
        @update:model-value="emit('update:modelValue', String($event ?? ''))"
        @keydown.enter.prevent="emit('next')"
      />
    </div>
    <p v-if="error" class="text-error text-sm" role="alert">
      {{ error }}
    </p>
  </div>
</template>

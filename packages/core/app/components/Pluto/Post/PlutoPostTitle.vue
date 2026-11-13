<script setup lang="ts">
defineProps<{
  modelValue: string
  label: string
  error?: string
  disabled?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  next: []
}>()

const { t } = usePlutoI18n()
</script>

<template>
  <div class="flex flex-col gap-1">
    <div class="group relative flex flex-col">
      <UIcon
        name="i-lucide-pencil"
        class="text-dimmed pointer-events-none absolute -inset-s-9 top-3.5 size-4 opacity-0 transition-opacity group-focus-within:opacity-0! group-hover:opacity-100"
        aria-hidden="true"
      />
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

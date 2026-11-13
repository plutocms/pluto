<script setup lang="ts">
const props = defineProps<{
  insert: (text: string, options?: { block?: boolean }) => void
  disabled?: boolean
}>()

const { t } = usePlutoI18n()

const items = computed(() =>
  MDC_SNIPPETS.map((snippet) => ({
    label: t(snippet.label),
    icon: snippet.icon,
    onSelect: () => props.insert(snippet.text, { block: snippet.block }),
  }))
)
</script>

<template>
  <UDropdownMenu
    :items="items"
    :content="{ align: 'start' }"
    :disabled="disabled"
  >
    <UButton
      :label="t('docs.mdc.insert')"
      :disabled="disabled"
      color="neutral"
      variant="ghost"
      size="xs"
      icon="i-lucide-plus"
      trailing-icon="i-lucide-chevron-down"
    />
  </UDropdownMenu>
</template>

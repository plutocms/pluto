<script setup lang="ts">
const props = defineProps<{
  text: string
  label?: string
}>()

const { t } = usePlutoI18n()
const { copy, copied } = useClipboard({ copiedDuring: 2000 })

const name = computed(() => props.label ?? t('pluto.mail.copy.copy'))
</script>

<template>
  <UTooltip :text="copied ? t('pluto.mail.copy.copied') : name">
    <UButton
      :icon="copied ? 'lucide:check' : 'lucide:copy'"
      :aria-label="name"
      :color="copied ? 'success' : 'neutral'"
      variant="ghost"
      size="xs"
      @click="copy(props.text)"
    />
  </UTooltip>
</template>

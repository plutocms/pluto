<script setup lang="ts">
const panel = inject(plutoViewLeftPanelKey, null)
const { t } = usePlutoI18n()
const isDesktop = useMediaQuery('(min-width: 64rem)')

onMounted(() => {
  if (panel) {
    panel.collapseButtons.value++
  }
})
onBeforeUnmount(() => {
  if (panel) {
    panel.collapseButtons.value--
  }
})
</script>

<template>
  <UTooltip v-if="panel && isDesktop" :text="t('pluto.canvas.closePanel')">
    <UButton
      :aria-label="t('pluto.canvas.closePanel')"
      icon="lucide:x"
      color="neutral"
      variant="ghost"
      size="sm"
      square
      @click="panel.close()"
    />
  </UTooltip>
</template>

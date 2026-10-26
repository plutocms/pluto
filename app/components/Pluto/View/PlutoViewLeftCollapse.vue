<script setup lang="ts">
// The button that hides the left panel of a PlutoViewAdminPanel. Put it in the
// header of the panel content, for example next to the panel title. It shows
// on desktop only: on a narrow screen the panel is a slideover with its own
// close button. While one is mounted, the content form hides its own toolbar
// toggle for the open panel, so the panel has one way to close.
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
  <UTooltip v-if="panel && isDesktop" :text="t('pluto.canvas.hideSidebar')">
    <UButton
      :aria-label="t('pluto.canvas.hideSidebar')"
      icon="lucide:panel-left-close"
      color="neutral"
      variant="ghost"
      size="sm"
      square
      @click="panel.close()"
    />
  </UTooltip>
</template>

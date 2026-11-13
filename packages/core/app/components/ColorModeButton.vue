<script setup lang="ts">
const colorMode = useColorMode()
const { t } = usePlutoI18n()

const isDark = computed(() => colorMode.value === 'dark')
const label = computed(() =>
  isDark.value
    ? t('pluto.common.switchToLightMode')
    : t('pluto.common.switchToDarkMode')
)

function toggle() {
  colorMode.preference = isDark.value ? 'light' : 'dark'
}
</script>

<template>
  <ClientOnly v-if="!colorMode.forced">
    <button
      :aria-label="label"
      :title="label"
      type="button"
      class="pluto-color-mode-button"
      @click="toggle"
    >
      <UIcon :name="isDark ? 'i-lucide-moon' : 'i-lucide-sun'" />
    </button>
  </ClientOnly>
</template>

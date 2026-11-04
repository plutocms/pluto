<script setup lang="ts">
// A light and dark mode toggle for a site: a plain <button> with an icon, and
// the `pluto-color-mode-button` class. Style it with your own classes. The icon
// is 1em square, so `font-size` sets its size.
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
  <!--
    The color mode is known in the browser only. Until then, an empty <span>
    with the same classes keeps the space.
  -->
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

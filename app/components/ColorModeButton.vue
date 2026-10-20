<script setup>
const colorMode = useColorMode()
const { t } = usePlutoI18n()

const isDark = computed({
  get() {
    return colorMode.value === 'dark'
  },
  set() {
    colorMode.preference = colorMode.value === 'dark' ? 'light' : 'dark'
  },
})
</script>

<template>
  <ClientOnly v-if="!colorMode?.forced">
    <PlutoNavbarHit
      :icon="isDark ? 'i-lucide-moon' : 'i-lucide-sun'"
      :label="isDark ? t('pluto.common.switchToLightMode') : t('pluto.common.switchToDarkMode')"
      square
      @click="isDark = !isDark"
    />

    <template #fallback>
      <div class="h-full w-8" />
    </template>
  </ClientOnly>
</template>

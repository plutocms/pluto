<script setup lang="ts">
const { t } = usePlutoI18n()

useHead({
  titleTemplate: (title) => {
    const websiteName = t('pluto.app.name')
    return title ? `${title} - ${websiteName}` : websiteName
  },
})
</script>

<template>
  <PlutoRoot>
    <NuxtPage />
  </PlutoRoot>
</template>

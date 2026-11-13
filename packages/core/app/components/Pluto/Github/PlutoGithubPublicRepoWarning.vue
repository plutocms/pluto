<script setup lang="ts">
const { t } = usePlutoI18n()
</script>

<template>
  <UAlert
    :title="t('pluto.github.publicRepo.title')"
    :description="t('pluto.github.publicRepo.description')"
    color="warning"
    variant="subtle"
    icon="lucide:triangle-alert"
  />
</template>

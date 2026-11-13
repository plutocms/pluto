<script setup lang="ts">
definePageMeta({ layout: 'auth' })

const { t } = usePlutoI18n()

useHead({ title: () => t('pluto.notConfigured.title') })
</script>

<template>
  <PlutoAdminAuthCard :title="t('pluto.notConfigured.title')">
    <UAlert
      :description="t('pluto.notConfigured.description')"
      color="warning"
      icon="lucide:plug-zap"
      variant="subtle"
    />
  </PlutoAdminAuthCard>
</template>

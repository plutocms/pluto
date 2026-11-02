<script setup lang="ts">
// The page for an admin with no auth driver in production: the backend is
// missing or did not load. The route guard sends every admin path here (see
// `driverDecision`), so the admin pages do not show to everyone. The frame is
// PlutoAdminAuthCard. See the admin-shell skill.
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

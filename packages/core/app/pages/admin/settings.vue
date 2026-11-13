<script setup lang="ts">
const { t } = usePlutoI18n()

useHead({
  title: () => t('pluto.pages.settings'),
})

const { current, allowed } = usePlutoSettingsPages()
</script>

<template>
  <PlutoViewAdminPanel>
    <template #toolbar>
      <PlutoViewToolbar
        :title="t('pluto.pages.settings')"
        icon="lucide:settings"
      />
      <PlutoAdminNavTabs />
    </template>

    <UAlert
      v-if="!allowed"
      :title="t('pluto.settings.noPermission.title')"
      :description="
        t('pluto.settings.noPermission.description', {
          page: current?.label ?? '',
        })
      "
      icon="lucide:lock"
      color="warning"
    />

    <NuxtPage v-else />
  </PlutoViewAdminPanel>
</template>

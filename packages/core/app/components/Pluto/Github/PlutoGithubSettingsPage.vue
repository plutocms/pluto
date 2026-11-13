<script setup lang="ts">
const { t } = usePlutoI18n()

useHead({
  title: () =>
    `${t('pluto.github.setup.page.settings.title')} - ${t('pluto.pages.settings')}`,
})
</script>

<template>
  <UCard>
    <template #header>
      <h2 class="font-semibold">
        {{ t('pluto.github.setup.page.settings.title') }}
      </h2>
      <p class="text-muted text-sm">
        {{ t('pluto.github.setup.page.settings.intro') }}
      </p>
    </template>

    <PlutoGithubSetupPanel variant="settings" />
  </UCard>
</template>

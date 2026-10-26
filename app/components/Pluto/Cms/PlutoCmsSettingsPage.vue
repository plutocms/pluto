<script setup lang="ts">
// The GitHub tab of Settings. The CMS module adds the route
// `/admin/settings/github` with `extendPages`, only when the CMS is on. The tab
// is the `settingsPages` entry of the CMS client plugin. The panel is the same
// checklist as the login card. In development, the Create button writes `.env`.
// The file lives under `app/` so Tailwind scans it. See the github-cms skill.
const { t } = usePlutoI18n()

useHead({
  title: () => `${t('pluto.cms.setup.page.settings.title')} - ${t('pluto.pages.settings')}`,
})
</script>

<template>
  <div class="flex flex-col gap-y-6">
    <div>
      <h2 class="text-xl font-semibold">{{ t('pluto.cms.setup.page.settings.title') }}</h2>
      <p class="text-muted text-sm">{{ t('pluto.cms.setup.page.settings.intro') }}</p>
    </div>

    <UCard class="max-w-2xl">
      <PlutoCmsSetupPanel variant="settings" />
    </UCard>
  </div>
</template>

<script setup lang="ts">
// The General tab of Settings. The parent page (`../settings.vue`) draws the
// title and the tabs.
const { t } = usePlutoI18n()

useHead({
  title: () => t('pluto.pages.settings'),
})

const { items } = usePlutoSettingsPanels()
const { hasDriver, status, load, save } = usePlutoSettings()

onMounted(() => {
  if (hasDriver.value) {
    load()
  }
})
</script>

<template>
  <div class="flex flex-col gap-y-6 lg:gap-y-8">
    <!-- Per-user, so it needs no capability and no settings driver. -->
    <PlutoSettingsLanguage />

    <UAlert
      v-if="!hasDriver"
      :title="t('pluto.settings.noStorage')"
      :description="t('pluto.settings.noStorageHint')"
      color="warning"
    />

    <template v-else>
      <UCard v-for="panel in items" :key="panel.id">
        <template #header>
          <h2 class="font-semibold">{{ panel.title }}</h2>
          <p v-if="panel.description" class="text-muted text-sm">{{ panel.description }}</p>
        </template>

        <Suspense>
          <component :is="panel.component" />

          <template #fallback>
            <PlutoSkeletonWidget variant="panel" height="8rem" />
          </template>
        </Suspense>
      </UCard>

      <div class="flex">
        <UButton :loading="status === 'saving'" icon="lucide:save" @click="save">
          {{ t('pluto.common.save') }}
        </UButton>
      </div>
    </template>
  </div>
</template>

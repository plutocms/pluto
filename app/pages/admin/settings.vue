<script setup lang="ts">
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
  <main>
    <AdminView>
      <h1 class="text-3xl font-bold lg:text-4xl">{{ t('pluto.pages.settings') }}</h1>

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

          <component :is="panel.component" />
        </UCard>

        <div class="flex">
          <UButton :loading="status === 'saving'" icon="lucide:save" @click="save">
            {{ t('pluto.common.save') }}
          </UButton>
        </div>
      </template>
    </AdminView>
  </main>
</template>

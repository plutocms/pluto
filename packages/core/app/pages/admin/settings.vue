<script setup lang="ts">
// The parent of every Settings page: the title, the tabs, and the child route.
// A layer adds a tab with a file at `pages/admin/settings/<x>.vue` and a
// `settingsPages` entry. The tabs are the children of the Settings item of the
// menu (PlutoAdminNavTabs), like every item with a submenu. See the
// extension-registry skill.
const { t } = usePlutoI18n()

useHead({
  title: () => t('pluto.pages.settings'),
})

const { current, allowed } = usePlutoSettingsPages()
</script>

<template>
  <main>
    <AdminView>
      <h1 class="text-3xl font-bold lg:text-4xl">
        {{ t('pluto.pages.settings') }}
      </h1>

      <!-- One page (General only) has no submenu, so no tabs. -->
      <PlutoAdminNavTabs />

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
    </AdminView>
  </main>
</template>

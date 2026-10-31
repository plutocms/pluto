<script setup lang="ts">
// The admin menu on a public page. The admin navbar shows on the public site
// for a logged-in admin, and its menu button opens the admin sidebar. Public
// pages do not use the admin layout, so that sidebar is not there. This
// slideover shows the same menu instead. PlutoRoot renders it on public
// routes only.
const open = usePlutoAdminMenuOpen()
const menu = usePlutoAdminMenu()
const openGroups = usePlutoAdminMenuGroups()
const { t } = usePlutoI18n()
</script>

<template>
  <USlideover
    v-model:open="open"
    :ui="{ content: 'w-[min(18rem,85vw)]' }"
    side="left"
  >
    <!--
      The slideover renders at the end of <body>, outside the navbar. The
      `data-pluto-admin-scope` wrapper gives it the admin theme there.
    -->
    <template #content>
      <div
        class="text-default flex h-full flex-col bg-(--pluto-admin-sidebar)"
        data-pluto-admin-scope
      >
        <div class="flex shrink-0 justify-end p-2">
          <UButton
            :aria-label="t('pluto.common.close')"
            icon="lucide:x"
            color="neutral"
            variant="ghost"
            square
            @click="open = false"
          />
        </div>

        <div class="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
          <PlutoAdminNavMenu
            v-model="openGroups"
            :items="menu"
            orientation="vertical"
            variant="pill"
            class="data-[orientation=vertical]:w-full"
          />
        </div>
      </div>
    </template>
  </USlideover>
</template>

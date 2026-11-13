<script setup lang="ts">
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
    <template #content>
      <div
        class="text-default flex h-full flex-col bg-(--pluto-admin-sidebar)"
        data-pluto-admin-scope
      >
        <div class="flex shrink-0 justify-end p-2">
          <UTooltip :text="t('pluto.common.close')">
            <UButton
              :aria-label="t('pluto.common.close')"
              icon="lucide:x"
              color="neutral"
              variant="ghost"
              square
              @click="open = false"
            />
          </UTooltip>
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

<script setup lang="ts">
// The backend badge of the admin navbar: "Git · GitHub", "Git · Local",
// "Database · Supabase". It tells the editor where the content goes. A click
// opens a popover with the details of the backend (its own component). A
// count (for example the commits that are not pushed) shows as a small pill.
// The backend comes from the `backend` field of `definePlutoExtension`. See
// the admin-shell skill.
const { t } = usePlutoI18n()
const { backend } = usePlutoBackend()
const open = ref(false)

const kindLabel = computed(() =>
  backend.value?.kind === 'database'
    ? t('pluto.backend.kind.database')
    : t('pluto.backend.kind.git')
)
// The icon of the provider (GitHub, Git, Supabase, ...), else a generic one for the kind.
const kindIcon = computed(
  () =>
    backend.value?.icon ||
    (backend.value?.kind === 'database'
      ? 'i-lucide-database'
      : 'i-lucide-git-branch')
)
const buttonLabel = computed(() => {
  const name = `${kindLabel.value} · ${backend.value?.label ?? ''}`
  return backend.value?.countLabel
    ? `${t('pluto.backend.open', { name })} (${backend.value.countLabel})`
    : t('pluto.backend.open', { name })
})

watch(open, (value) => {
  if (value) {
    backend.value?.onOpen?.()
  }
})
</script>

<template>
  <UPopover
    v-if="backend"
    v-model:open="open"
    :content="{ align: 'end', sideOffset: 4 }"
  >
    <PlutoNavbarHit :label="buttonLabel" size="sm">
      <span class="flex items-center gap-x-1.5">
        <UIcon :name="kindIcon" class="size-4 shrink-0" />
        <span class="hidden md:inline">{{ kindLabel }}</span>
        <span class="text-muted hidden md:inline">·</span>
        <span class="text-muted hidden max-w-32 truncate md:inline">
          {{ backend.label }}
        </span>
        <span
          v-if="backend.count"
          :title="backend.countLabel"
          class="bg-warning text-inverted rounded-full px-1.5 text-[0.6875rem]/4 font-semibold tabular-nums"
        >
          {{ backend.count }}
        </span>
      </span>
    </PlutoNavbarHit>

    <template #content>
      <div class="w-80 max-w-[calc(100vw-2rem)] p-4 text-sm">
        <div class="mb-3 flex items-center gap-x-2">
          <UIcon :name="kindIcon" class="text-highlighted size-5 shrink-0" />
          <div class="min-w-0">
            <p class="text-highlighted truncate font-semibold">
              {{ backend.label }}
            </p>
            <p class="text-muted text-xs">
              {{
                backend.kind === 'database'
                  ? t('pluto.backend.databaseMode')
                  : t('pluto.backend.gitMode')
              }}
            </p>
          </div>
        </div>
        <component :is="backend.details" v-if="backend.details" />
      </div>
    </template>
  </UPopover>
</template>

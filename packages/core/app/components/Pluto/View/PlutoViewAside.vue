<script setup lang="ts">
// Do not use UDashboardSidebar here. Its toggle hook is global, so this aside would open and close with the left sidebar.
withDefaults(
  defineProps<{
    title?: string
    width?: number
  }>(),
  {
    width: 320,
  }
)

defineSlots<{
  header?: () => unknown
  default?: () => unknown
}>()

const { t } = usePlutoI18n()

const open = defineModel<boolean>('open', { default: false })

function close() {
  open.value = false
}

// Render one copy only. A hidden copy stays mounted, fetches data, and its open slideover blocks pointer events.
const isDesktop = useMediaQuery('(min-width: 64rem)')
const resizable = inject(plutoViewAsideResizableKey, ref(false))
const slideoverOpen = computed({
  get: () => open.value && !isDesktop.value,
  set: (value: boolean) => {
    open.value = value
  },
})
usePlutoBackClose(slideoverOpen)
</script>

<template>
  <aside
    v-if="open && isDesktop"
    :style="resizable ? undefined : { width: `${width}px` }"
    :class="resizable ? 'w-full' : 'border-default shrink-0 border-s'"
    class="bg-pluto-rail flex h-full flex-col"
  >
    <div
      class="border-default flex h-12 shrink-0 items-center justify-between gap-1.5 border-b px-4"
    >
      <div v-if="$slots.header" class="min-w-0 flex-1">
        <slot name="header" />
      </div>
      <h2 v-else class="text-highlighted truncate text-sm font-semibold">
        {{ title }}
      </h2>
      <UTooltip :text="t('pluto.common.hidePanel')">
        <UButton
          :aria-label="t('pluto.common.hidePanel')"
          icon="lucide:panel-right-close"
          color="neutral"
          variant="ghost"
          size="sm"
          square
          @click="close"
        />
      </UTooltip>
    </div>
    <div
      class="min-h-0 flex-1 scrollbar-thumb-(--ui-border-accented) overflow-y-auto p-4"
    >
      <slot />
    </div>
  </aside>

  <!-- Keep the slot mounted after the first open, so a reopen keeps the widget state. -->
  <USlideover
    v-if="!isDesktop"
    v-model:open="slideoverOpen"
    :title="title"
    :unmount-on-hide="false"
    side="right"
  >
    <template v-if="$slots.header" #title>
      <slot name="header" />
    </template>

    <template #body>
      <slot />
    </template>
  </USlideover>
</template>

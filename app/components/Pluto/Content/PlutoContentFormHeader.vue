<script setup lang="ts">
// The toolbar of `PlutoContentForm`. Every layout uses it, so every edit page
// has the same top row: back, "Type > title", the save state, the status
// badge, the View link, the toolbar items of the layers, the buttons of the
// layers, Save or Publish, the
// overflow menu, and the panel toggles. It holds no form logic. The form passes
// the data in and handles the events.

const props = defineProps<{
  backTo: string
  /** The plural label of the type, before the title. */
  typeLabel: string
  title: string
  status?: {
 label: string
published: boolean
}
  saveState: PlutoSaveState
  /** The text of the `saved` state, for example "Saved 2 min ago". */
  savedText?: string
  /** The public URL of the item. The "View" link shows only when it is set. */
  viewUrl?: string
  /** Components that a layer adds with `contentToolbarItems`, already filtered. They show before the buttons. */
  toolbarItems?: PlutoContentToolbarItem[]
  /** Buttons that a layer adds with `contentActions`, already filtered. */
  actions: PlutoFormHeaderButton[]
  /** The save and publish buttons, already filtered. */
  buttons: PlutoFormHeaderButton[]
  saving: boolean
  canUnpublish: boolean
  canDelete: boolean
  asideToggle?: PlutoFormHeaderToggle
  leftToggle?: PlutoFormHeaderToggle
}>()

const emit = defineEmits<{
  /** A button of `buttons` or `actions` was pressed. */
  press: [id: string]
  retry: []
  unpublish: []
  delete: []
  toggleAside: []
  toggleLeft: []
}>()

const { t } = usePlutoI18n()

// Below `sm` (40rem) the row is tight: the View link moves into the overflow
// menu, and a secondary button shows its icon only.
const isSm = useMediaQuery('(min-width: 40rem)')

const menuItems = computed(() => [
  [
    ...(props.viewUrl && !isSm.value
      ? [{ label: t('pluto.form.view'), icon: 'lucide:external-link', to: props.viewUrl, target: '_blank' }]
      : []),
    ...(props.canUnpublish
      ? [{ label: t('pluto.form.unpublish'), icon: 'lucide:eye-off', onSelect: () => emit('unpublish') }]
      : []),
    ...(props.canDelete
      ? [{ label: t('pluto.common.delete'), icon: 'lucide:trash', color: 'error' as const, onSelect: () => emit('delete') }]
      : []),
  ],
])
const hasMenu = computed(() => menuItems.value[0]!.length > 0)

const stateText = computed(() => {
  switch (props.saveState) {
    case 'dirty':
      return t('pluto.form.unsaved')
    case 'saving':
      return t('pluto.form.saving')
    case 'saved':
      return props.savedText ?? t('pluto.form.savedJustNow')
    case 'failed':
      return t('pluto.form.saveFailed')
    default:
      return ''
  }
})
</script>

<template>
  <PlutoViewToolbar :back-to="backTo">
    <template #title>
      <span class="text-muted hidden shrink-0 font-normal sm:inline">{{ typeLabel }}</span>
      <UIcon name="i-lucide-chevron-right" class="text-muted hidden size-4 shrink-0 sm:block" />
      <span class="truncate">{{ title }}</span>
    </template>

    <template #right>
      <!-- The state is a live region: a screen reader hears it change. -->
      <div
        role="status"
        aria-live="polite"
        class="flex items-center gap-1.5 text-sm"
      >
        <template v-if="saveState === 'dirty'">
          <span class="bg-warning size-2 shrink-0 rounded-full" aria-hidden="true" />
          <span class="text-muted hidden md:inline">{{ stateText }}</span>
          <span class="sr-only md:hidden">{{ stateText }}</span>
        </template>

        <template v-else-if="saveState === 'saving'">
          <UIcon name="i-lucide-loader-circle" class="text-muted size-4 shrink-0 animate-spin" aria-hidden="true" />
          <span class="text-muted hidden md:inline">{{ stateText }}</span>
          <span class="sr-only md:hidden">{{ stateText }}</span>
        </template>

        <template v-else-if="saveState === 'saved'">
          <UIcon name="i-lucide-check" class="text-success size-4 shrink-0" aria-hidden="true" />
          <span class="text-muted hidden md:inline">{{ stateText }}</span>
          <span class="sr-only md:hidden">{{ stateText }}</span>
        </template>

        <template v-else-if="saveState === 'failed'">
          <UIcon name="i-lucide-circle-alert" class="text-error size-4 shrink-0" aria-hidden="true" />
          <span class="text-error hidden sm:inline">{{ stateText }}</span>
          <UButton
            :label="t('pluto.form.retry')"
            :disabled="saving"
            size="xs"
            color="error"
            variant="link"
            class="px-1"
            @click="emit('retry')"
          />
        </template>
      </div>

      <UBadge
        v-if="status"
        :color="status.published ? 'success' : 'neutral'"
        variant="subtle"
        class="hidden sm:inline-flex"
      >
        {{ status.label }}
      </UBadge>

      <UButton
        v-if="viewUrl && isSm"
        :to="viewUrl"
        :label="t('pluto.form.view')"
        icon="lucide:external-link"
        color="neutral"
        variant="ghost"
        target="_blank"
      />

      <component
        :is="item.component"
        v-for="item in toolbarItems"
        :key="item.id"
      />

      <UButton
        v-for="action in actions"
        :key="action.id"
        :label="action.secondary && !isSm ? undefined : action.label"
        :aria-label="action.label"
        :icon="action.icon"
        :color="action.color"
        :variant="action.variant"
        :square="action.secondary && !isSm"
        @click="emit('press', action.id)"
      />

      <UButton
        v-for="button in buttons"
        :key="button.id"
        :label="button.secondary && !isSm ? undefined : button.label"
        :aria-label="button.label"
        :icon="button.icon"
        :variant="button.variant"
        :color="button.color"
        :square="button.secondary && !isSm"
        :loading="saving"
        @click="emit('press', button.id)"
      />

      <UDropdownMenu v-if="hasMenu" :items="menuItems">
        <UTooltip :text="t('pluto.form.moreActions')">
          <UButton
            :aria-label="t('pluto.form.moreActions')"
            icon="lucide:ellipsis-vertical"
            color="neutral"
            variant="ghost"
            square
          />
        </UTooltip>
      </UDropdownMenu>

      <UTooltip v-if="leftToggle" :text="leftToggle.label">
        <UButton
          :aria-label="leftToggle.label"
          :icon="leftToggle.icon"
          color="neutral"
          variant="ghost"
          square
          @click="emit('toggleLeft')"
        />
      </UTooltip>

      <UTooltip v-if="asideToggle" :text="asideToggle.label">
        <UButton
          :aria-label="asideToggle.label"
          :icon="asideToggle.icon"
          color="neutral"
          variant="ghost"
          square
          @click="emit('toggleAside')"
        />
      </UTooltip>
    </template>
  </PlutoViewToolbar>
</template>

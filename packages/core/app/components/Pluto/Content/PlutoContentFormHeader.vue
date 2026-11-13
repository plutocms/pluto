<script setup lang="ts">
const props = defineProps<{
  backTo?: string
  typeLabel: string
  title: string
  status?: {
    label: string
    published: boolean
    color?: 'success' | 'neutral' | 'info' | 'warning'
    title?: string
  }
  saveState: PlutoSaveState
  savedText?: string
  viewUrl?: string
  itemLabel?: string
  toolbarItems?: PlutoContentToolbarItem[]
  actions: PlutoFormHeaderButton[]
  buttons: PlutoFormHeaderButton[]
  saving: boolean
  canUnpublish: boolean
  unpublishLabel?: string
  canDelete: boolean
  trash?: boolean
  asideToggle?: PlutoFormHeaderToggle
  leftToggle?: PlutoFormHeaderToggle
}>()

const emit = defineEmits<{
  press: [id: string]
  retry: []
  unpublish: []
  delete: []
  toggleAside: []
  toggleLeft: []
}>()

const { t } = usePlutoI18n()

const pressed = ref<string | null>(null)
function press(id: string) {
  pressed.value = id
  emit('press', id)
  nextTick(() => {
    if (!props.saving) {
      pressed.value = null
    }
  })
}
watch(
  () => props.saving,
  (saving) => {
    if (!saving) {
      pressed.value = null
    }
  }
)

const isSm = useMediaQuery('(min-width: 40rem)')

const viewLabel = computed(() =>
  props.itemLabel
    ? t('pluto.form.viewItem', { label: props.itemLabel })
    : t('pluto.form.view')
)

const menuItems = computed(() => [
  [
    ...(props.viewUrl && !isSm.value
      ? [
          {
            label: viewLabel.value,
            icon: 'lucide:eye',
            to: props.viewUrl,
            target: '_blank',
          },
        ]
      : []),
    ...(props.canUnpublish
      ? [
          {
            label: props.unpublishLabel ?? t('pluto.form.unpublish'),
            icon: 'lucide:eye-off',
            onSelect: () => emit('unpublish'),
          },
        ]
      : []),
    ...(props.canDelete
      ? [
          {
            label: props.trash
              ? t('pluto.list.trash.move')
              : t('pluto.common.delete'),
            icon: 'lucide:trash',
            color: 'error' as const,
            onSelect: () => emit('delete'),
          },
        ]
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
      <NuxtLink
        v-if="backTo"
        :to="backTo"
        class="text-muted hover:text-highlighted focus-visible:outline-primary hidden shrink-0 rounded-sm text-sm font-normal focus-visible:outline-2 sm:inline"
      >
        {{ typeLabel }}
      </NuxtLink>
      <UIcon
        v-if="backTo"
        name="i-lucide-chevron-right"
        class="text-muted hidden size-4 shrink-0 sm:block"
      />
      <UTooltip v-if="saveState === 'dirty'" :text="stateText">
        <span
          class="bg-warning size-2 shrink-0 rounded-full"
          aria-hidden="true"
        />
      </UTooltip>
      <span class="truncate text-sm" aria-current="page">{{ title }}</span>
    </template>

    <template #trailing>
      <UBadge
        v-if="status"
        :color="status.color ?? (status.published ? 'success' : 'neutral')"
        :title="status.title"
        variant="subtle"
        class="ms-1 hidden shrink-0 sm:inline-flex"
      >
        {{ status.label }}
      </UBadge>

      <div
        role="status"
        aria-live="polite"
        class="flex shrink-0 items-center gap-1.5 text-sm font-normal"
      >
        <span v-if="saveState === 'dirty'" class="sr-only">{{
          stateText
        }}</span>

        <template v-else-if="saveState === 'saving'">
          <UIcon
            name="i-lucide-loader-circle"
            class="text-muted size-4 shrink-0 animate-spin"
            aria-hidden="true"
          />
          <span class="text-muted hidden md:inline">{{ stateText }}</span>
          <span class="sr-only md:hidden">{{ stateText }}</span>
        </template>

        <template v-else-if="saveState === 'saved'">
          <span class="text-muted hidden md:inline">{{ stateText }}</span>
          <span class="sr-only md:hidden">{{ stateText }}</span>
        </template>

        <template v-else-if="saveState === 'failed'">
          <UIcon
            name="i-lucide-circle-alert"
            class="text-error size-4 shrink-0"
            aria-hidden="true"
          />
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
    </template>

    <template #right>
      <UButton
        v-if="viewUrl && isSm"
        :to="viewUrl"
        :label="viewLabel"
        trailing-icon="i-lucide-arrow-up-right"
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
        :loading="saving && pressed === button.id"
        :disabled="saving && pressed !== button.id"
        @click="press(button.id)"
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

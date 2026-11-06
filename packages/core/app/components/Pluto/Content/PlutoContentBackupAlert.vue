<script setup lang="ts">
// The recovery offer of the content backup, above the fields of the form. The browser kept
// unsaved changes of this item. The user restores them, discards them, or looks at them first
// ("Show changes", a slideover with the same diff as History). See the content-backup skill.
import type { PlutoBackupOffer } from '../../../composables/pluto-content-backup'

const props = defineProps<{
  type: PlutoContentType | undefined
  offer: PlutoBackupOffer
  /** The changes that a restore makes, from `diffFields`. */
  changes: PlutoFieldChange[]
  /** The canvas layout gives the alert its own margin. */
  canvas?: boolean
}>()

const emit = defineEmits<{
  restore: []
  discard: []
}>()

const { t, d } = usePlutoI18n()
const text = usePlutoContentText(() => props.type)
const open = ref(false)

const time = computed(() =>
  d(props.offer.record.savedAt, { dateStyle: 'medium', timeStyle: 'short' })
)
const description = computed(() =>
  t(
    props.offer.otherDevice
      ? 'pluto.backup.descriptionOtherDevice'
      : 'pluto.backup.description',
    { time: time.value }
  )
)
const conflicts = computed(() =>
  props.offer.conflicts.map((field) => text.fieldLabel(field)).join(', ')
)

function restore() {
  open.value = false
  emit('restore')
}
</script>

<template>
  <!-- A div, because the alert is `w-full`: a margin on it would push it out of the canvas. -->
  <div :class="canvas ? 'shrink-0 p-4' : undefined">
    <UAlert
      :title="t('pluto.backup.title')"
      color="info"
      variant="subtle"
      icon="lucide:life-buoy"
      role="status"
    >
      <template #description>
        <p>{{ description }}</p>
        <p v-if="offer.conflicts.length > 0" class="mt-1">
          {{ t('pluto.backup.conflicts', { fields: conflicts }) }}
        </p>
        <div class="mt-3 flex flex-wrap items-center gap-2">
          <UButton
            :label="t('pluto.backup.restore')"
            icon="lucide:rotate-ccw"
            size="xs"
            color="info"
            @click="restore"
          />
          <UButton
            :label="t('pluto.backup.discard')"
            icon="lucide:trash-2"
            size="xs"
            color="neutral"
            variant="outline"
            @click="emit('discard')"
          />
          <UButton
            :label="t('pluto.backup.showChanges')"
            icon="lucide:file-diff"
            size="xs"
            color="neutral"
            variant="ghost"
            @click="open = true"
          />
        </div>
      </template>
    </UAlert>

    <USlideover
      v-model:open="open"
      :title="t('pluto.backup.changesTitle')"
      :description="description"
      :ui="{ content: 'sm:max-w-3xl' }"
      side="right"
    >
      <template #body>
        <div class="flex flex-col gap-5">
          <p class="text-muted text-xs">
            {{ t('pluto.backup.changesHint') }}
          </p>
          <PlutoContentChanges
            :type="type"
            :changes="changes"
            :before-label="t('pluto.backup.saved')"
            :after-label="t('pluto.backup.backup')"
          />
        </div>
      </template>

      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton
            :label="t('pluto.backup.discard')"
            icon="lucide:trash-2"
            color="neutral"
            variant="outline"
            @click="emit('discard')"
          />
          <UButton
            :label="t('pluto.backup.restore')"
            icon="lucide:rotate-ccw"
            @click="restore"
          />
        </div>
      </template>
    </USlideover>
  </div>
</template>

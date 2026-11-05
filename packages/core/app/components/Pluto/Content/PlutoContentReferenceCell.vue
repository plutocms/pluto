<script setup lang="ts">
// The cell of a `reference` field with a `target` in the content list: the labels of the
// referenced items as badges, up to three, then "+N". An id with no item shows its text.
const props = defineProps<{
  field: PlutoReferenceField
  /** The stored value of the field: one id or a list of ids. */
  value: unknown
}>()

const MAX_BADGES = 3

const { n } = usePlutoI18n()
const { options, byId, ensure } = usePlutoReferenceOptions(
  () => props.field.target ?? ''
)

onMounted(() => {
  if (options.value.length === 0) {
    ensure().catch(() => {})
  }
})

// The labels keep the order of the stored ids.
const labels = computed(() =>
  referenceFieldIds(props.value).map((id) => ({
    key: id,
    label: byId.value.get(id)?.label ?? id,
  }))
)
const shown = computed(() => labels.value.slice(0, MAX_BADGES))
const hidden = computed(() => labels.value.length - shown.value.length)
</script>

<template>
  <div v-if="labels.length > 0" class="flex flex-wrap items-center gap-1">
    <UBadge
      v-for="entry in shown"
      :key="entry.key"
      :label="entry.label"
      color="neutral"
      variant="subtle"
    />

    <span v-if="hidden > 0" class="text-muted text-xs">+{{ n(hidden) }}</span>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  field: PlutoReferenceField
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

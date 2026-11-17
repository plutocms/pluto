<script setup lang="ts">
const { t } = usePlutoI18n()
const { can } = usePlutoPermissions()
const form = usePlutoContentForm()

const handle = computed(() =>
  String(form?.item.value?.slug ?? form?.item.value?.id ?? '')
)
</script>

<template>
  <UButton
    v-if="form?.editing.value && handle && can('forms:read_submissions')"
    :to="`/admin/forms/${handle}`"
    :label="t('forms.admin.title')"
    icon="i-lucide-inbox"
    color="neutral"
    variant="ghost"
  />
</template>

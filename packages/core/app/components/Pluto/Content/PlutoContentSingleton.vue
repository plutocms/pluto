<script setup lang="ts">
import type { PlutoContentListResult } from '../../../../shared/types/content'

const props = defineProps<{
  type: string
}>()

const { t } = usePlutoI18n()
const errorText = usePlutoErrorText()

const { data, error, status, refresh } = useFetch<PlutoContentListResult>(
  () => `/api/_pluto/content/${encodeURIComponent(props.type)}`,
  {
    key: `pluto-singleton:${props.type}`,
    query: {
      limit: 1,
    },
    server: false,
  }
)

const createdId = ref<string | number>()

const id = computed(() => createdId.value ?? data.value?.data[0]?.id)

function onCreated(value: string | number) {
  createdId.value = value
}
</script>

<template>
  <div
    v-if="status === 'idle' || status === 'pending'"
    class="flex justify-center p-8"
  >
    <UIcon
      name="i-lucide-loader-circle"
      class="text-muted size-6 animate-spin"
    />
  </div>

  <div v-else-if="error" class="p-8">
    <UAlert
      :title="t('pluto.common.error')"
      :description="errorText(error, 'pluto.list.loadFailedHint')"
      :actions="[
        {
          label: t('pluto.form.retry'),
          color: 'neutral',
          variant: 'outline',
          onClick: () => refresh(),
        },
      ]"
      color="error"
      variant="subtle"
      icon="i-lucide-circle-alert"
    />
  </div>

  <PlutoContentForm
    v-else
    :id="id"
    :key="id ?? 'new'"
    :type="props.type"
    @created="onCreated"
  />
</template>

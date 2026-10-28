<script setup lang="ts">
// The DNS records that Resend asks for. The admin adds them at the DNS
// provider of the domain. Each name and value has a copy button.
defineProps<{
  records: PlutoMailDomainRecord[]
}>()

const { t } = usePlutoI18n()

function stateOf(record: PlutoMailDomainRecord) {
  const state = plutoMailDomainState(record.status)
  return {
    verified: {
      label: t('pluto.mail.domain.recordVerified'),
      color: 'success' as const,
    },
    pending: {
      label: t('pluto.mail.domain.recordPending'),
      color: 'warning' as const,
    },
    failed: {
      label: t('pluto.mail.domain.recordFailed'),
      color: 'error' as const,
    },
  }[state]
}
</script>

<template>
  <div class="border-default overflow-x-auto rounded-md border">
    <table class="w-full min-w-max text-left text-sm">
      <thead class="bg-elevated/50 text-muted">
        <tr>
          <th class="px-3 py-2 font-medium">
            {{ t('pluto.mail.domain.columns.type') }}
          </th>
          <th class="px-3 py-2 font-medium">
            {{ t('pluto.mail.domain.columns.name') }}
          </th>
          <th class="px-3 py-2 font-medium">
            {{ t('pluto.mail.domain.columns.value') }}
          </th>
          <th class="px-3 py-2 font-medium">
            {{ t('pluto.mail.domain.columns.priority') }}
          </th>
          <th class="px-3 py-2 font-medium">
            {{ t('pluto.mail.domain.columns.status') }}
          </th>
        </tr>
      </thead>
      <tbody class="divide-default divide-y">
        <tr
          v-for="record in records"
          :key="`${record.type}-${record.name}-${record.value}`"
        >
          <td class="px-3 py-2 align-top">
            <span class="font-medium">{{ record.type }}</span>
            <span v-if="record.record" class="text-muted block text-xs">{{
              record.record
            }}</span>
          </td>
          <td class="px-3 py-2 align-top">
            <div class="flex items-center gap-1">
              <code class="break-all">{{ record.name }}</code>
              <PlutoMailCopy
                :text="record.name"
                :label="t('pluto.mail.domain.copyName')"
              />
            </div>
          </td>
          <td class="max-w-md px-3 py-2 align-top">
            <div class="flex items-start gap-1">
              <code class="break-all">{{ record.value }}</code>
              <PlutoMailCopy
                :text="record.value"
                :label="t('pluto.mail.domain.copyValue')"
              />
            </div>
          </td>
          <td class="px-3 py-2 align-top">
            {{ record.priority ?? '-' }}
          </td>
          <td class="px-3 py-2 align-top">
            <UBadge
              :label="stateOf(record).label"
              :color="stateOf(record).color"
              variant="subtle"
              size="sm"
            />
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

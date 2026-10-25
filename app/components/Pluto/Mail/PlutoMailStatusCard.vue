<script setup lang="ts">
// The state of the mail setup at a glance: which driver sends, whether it can
// send, and the From address. It loads the status from the server. The
// server sends no secret, only "a key is set" or not.
const { t, te } = usePlutoI18n()
const errorText = usePlutoErrorText()
const { status, statusPending, loadStatus } = usePlutoMail()

const loadError = ref<string | null>(null)

async function load() {
  loadError.value = null
  try {
    await loadStatus()
  } catch (error) {
    loadError.value = errorText(error, 'pluto.mail.status.loadFailed')
  }
}

onMounted(load)

const driverName = computed(() => {
  const id = status.value?.driver ?? ''
  const key = `pluto.mail.status.driverNames.${id}`
  return te(key) ? t(key) : id
})

const note = computed(() => {
  if (!status.value) {
    return null
  }
  if (status.value.mailpit) {
    return t('pluto.mail.status.noteMailpit')
  }
  if (status.value.logOnly) {
    return t('pluto.mail.status.noteLogOnly')
  }
  if (!status.value.configured) {
    return t('pluto.mail.status.noteNotConfigured')
  }
  return null
})
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex items-center justify-between gap-3">
        <h2 class="font-semibold">{{ t('pluto.mail.status.title') }}</h2>
        <UButton
          :loading="statusPending"
          :aria-label="t('pluto.mail.status.refresh')"
          icon="lucide:refresh-cw"
          color="neutral"
          variant="ghost"
          size="xs"
          @click="load"
        />
      </div>
    </template>

    <UAlert v-if="loadError" :title="loadError" color="error" variant="subtle" icon="lucide:circle-alert" />

    <div v-else-if="!status" class="text-muted text-sm">{{ t('pluto.common.loading') }}</div>

    <div v-else class="flex flex-col gap-y-4">
      <div class="flex flex-wrap items-center gap-2">
        <UBadge
          :label="status.configured ? t('pluto.mail.status.ready') : t('pluto.mail.status.notReady')"
          :color="status.configured ? 'success' : 'warning'"
          variant="subtle"
        />
        <UBadge :label="t('pluto.mail.status.driver', { driver: driverName })" color="neutral" variant="outline" />
      </div>

      <dl class="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
        <div>
          <dt class="text-muted">{{ t('pluto.mail.status.key') }}</dt>
          <dd>{{ status.hasKey ? t('pluto.mail.status.keySet') : t('pluto.mail.status.keyNotSet') }}</dd>
        </div>
        <div>
          <dt class="text-muted">{{ t('pluto.mail.status.from') }}</dt>
          <dd class="break-all">{{ status.from ?? t('pluto.mail.status.fromEmpty') }}</dd>
        </div>
        <div>
          <dt class="text-muted">{{ t('pluto.mail.status.replyTo') }}</dt>
          <dd class="break-all">{{ status.replyTo ?? t('pluto.mail.status.replyToEmpty') }}</dd>
        </div>
      </dl>

      <UAlert v-if="note" :description="note" color="neutral" variant="subtle" icon="lucide:info" />
    </div>
  </UCard>
</template>

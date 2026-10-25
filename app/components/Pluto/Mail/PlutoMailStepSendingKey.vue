<script setup lang="ts">
// Step 7, optional: replace the setup key with a sending-only key for the one
// domain. A sending-only key cannot read or change anything in the Resend
// account, so a leak of the server environment does less harm.
//
// This is the one place where a key reaches the browser: the new key. The
// server shows it once, the admin copies it into the environment, and this
// component drops it when the page closes. Nothing stores it.
const { t } = usePlutoI18n()
const errorText = usePlutoErrorText()
const { keyState, domain, createSendingKey } = usePlutoMail()

const token = ref<string | null>(null)
const creating = ref(false)
const failure = ref<string | null>(null)

const lines = computed(() => (token.value ? [plutoMailEnvLine('NUXT_PLUTO_MAIL_RESEND_API_KEY', token.value)] : []))
const locked = computed(() => keyState.value !== 'full')

async function create() {
  creating.value = true
  failure.value = null
  try {
    token.value = await createSendingKey(domain.value?.id)
  } catch (error) {
    failure.value = errorText(error, 'pluto.mail.sendingKey.failed')
  } finally {
    creating.value = false
  }
}

onBeforeUnmount(() => {
  token.value = null
})
</script>

<template>
  <PlutoMailStep
    :number="7"
    :title="t('pluto.mail.sendingKey.title')"
    :description="t('pluto.mail.sendingKey.description')"
    :state="locked ? 'locked' : 'optional'"
  >
    <UAlert
      v-if="locked"
      :description="keyState === 'sending' ? t('pluto.mail.sendingKey.alreadySending') : t('pluto.mail.sendingKey.lockedKey')"
      color="neutral"
      variant="subtle"
      icon="lucide:lock"
    />

    <template v-else>
      <p class="text-muted text-sm">
        {{ domain ? t('pluto.mail.sendingKey.forDomain', { domain: domain.name }) : t('pluto.mail.sendingKey.forAccount') }}
      </p>

      <div v-if="!token">
        <UButton :loading="creating" icon="lucide:key-round" color="neutral" variant="outline" @click="create">
          {{ t('pluto.mail.sendingKey.create') }}
        </UButton>
      </div>

      <UAlert v-if="failure" :description="failure" color="error" variant="subtle" icon="lucide:circle-x" />

      <template v-if="token">
        <UAlert
          :title="t('pluto.mail.sendingKey.onceTitle')"
          :description="t('pluto.mail.sendingKey.onceBody')"
          color="warning"
          variant="subtle"
          icon="lucide:triangle-alert"
        />
        <PlutoMailEnvLines :lines="lines" />
        <p class="text-muted text-sm">{{ t('pluto.mail.sendingKey.next') }}</p>
      </template>
    </template>
  </PlutoMailStep>
</template>

<script setup lang="ts">
// The key never reaches the browser: the check runs on the server.
const { t } = usePlutoI18n()
const { status, keyState, checkKey } = usePlutoMail()

const lines = [
  plutoMailEnvLine('NUXT_PLUTO_MAIL_RESEND_API_KEY', 're_your_key_here'),
]

const checking = computed(() => keyState.value === 'checking')
const state = computed(() =>
  keyState.value === 'full' || keyState.value === 'sending' ? 'done' : 'todo'
)

onMounted(async () => {
  if (keyState.value === 'unknown' && !status.value) {
    await until(status)
      .toBeTruthy({ timeout: 10_000 })
      .catch(() => {})
  }
  if (keyState.value === 'unknown' && status.value?.hasKey) {
    await checkKey()
  }
})

const result = computed(() => {
  switch (keyState.value) {
    case 'full':
      return {
        color: 'success' as const,
        icon: 'lucide:circle-check',
        title: t('pluto.mail.key.full'),
        description: t('pluto.mail.key.fullHint'),
      }
    case 'sending':
      return {
        color: 'info' as const,
        icon: 'lucide:info',
        title: t('pluto.mail.key.sending'),
        description: t('pluto.mail.key.sendingHint'),
      }
    case 'invalid':
      return {
        color: 'error' as const,
        icon: 'lucide:circle-x',
        title: t('pluto.mail.key.invalid'),
        description: t('pluto.mail.key.invalidHint'),
      }
    case 'missing':
      return {
        color: 'warning' as const,
        icon: 'lucide:triangle-alert',
        title: t('pluto.mail.key.missing'),
        description: t('pluto.mail.key.missingHint'),
      }
    case 'failed':
      return {
        color: 'error' as const,
        icon: 'lucide:circle-x',
        title: t('pluto.mail.key.failed'),
        description: t('pluto.mail.key.failedHint'),
      }
    default:
      return null
  }
})
</script>

<template>
  <PlutoMailStep
    :number="2"
    :title="t('pluto.mail.key.title')"
    :description="t('pluto.mail.key.description')"
    :state="state"
  >
    <ol class="text-muted list-decimal space-y-1 pl-5 text-sm">
      <li>
        {{ t('pluto.mail.key.stepCreate') }}
        <PlutoExternalLink
          to="https://resend.com/api-keys"
          class="text-primary"
        >
          resend.com/api-keys
        </PlutoExternalLink>
      </li>
      <li><PlutoCodeText :text="t('pluto.mail.key.stepAdd')" /></li>
      <li>{{ t('pluto.mail.key.stepRestart') }}</li>
    </ol>

    <PlutoMailEnvLines :lines="lines" />

    <p class="text-muted text-sm">
      {{ t('pluto.mail.key.envHint') }}
    </p>

    <div>
      <UButton
        :loading="checking"
        icon="lucide:key-round"
        color="neutral"
        variant="outline"
        @click="checkKey"
      >
        {{ t('pluto.mail.key.check') }}
      </UButton>
    </div>

    <UAlert
      v-if="result"
      :title="result.title"
      :description="result.description"
      :color="result.color"
      :icon="result.icon"
      variant="subtle"
    />
  </PlutoMailStep>
</template>

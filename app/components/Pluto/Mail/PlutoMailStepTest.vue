<script setup lang="ts">
// A test email, in two places of the flow. `self` (step 3) sends to your own
// address, and works before you verify a domain, with the Resend test sender.
// `anyone` (step 6) sends to any address, after the domain is verified and the
// From address is set. Resend refuses the second case for an unverified
// domain. The 403 gets a plain explanation here.
const props = defineProps<{
  mode: 'self' | 'anyone'
  number: number
}>()

const { t, locale } = usePlutoI18n()
const errorText = usePlutoErrorText()
const { status, domain, sendTest } = usePlutoMail()
const { user } = usePlutoAuth()

const to = ref(props.mode === 'self' ? (user.value?.email ?? '') : '')
const sending = ref(false)
const sent = ref(false)
const failure = ref<{
  code?: string
  text: string
} | null>(null)

const emailValid = computed(() => isPlutoMailAddress(to.value.trim()))

// The key can send with either access level. Without a key, only the dev
// driver can "send" (it prints to the server console).
const canSend = computed(() => Boolean(status.value?.configured))

const domainVerified = computed(
  () =>
    domain.value !== null &&
    plutoMailDomainState(domain.value.status) === 'verified'
)

const state = computed(() => {
  if (sent.value) {
    return 'done'
  }
  if (!canSend.value || (props.mode === 'anyone' && !status.value?.from)) {
    return 'locked'
  }
  return 'todo'
})

const lockedHint = computed(() => {
  if (!canSend.value) {
    return t('pluto.mail.test.lockedKey')
  }
  if (props.mode === 'anyone' && !status.value?.from) {
    return t('pluto.mail.test.lockedFrom')
  }
  return null
})

async function send() {
  sending.value = true
  sent.value = false
  failure.value = null
  try {
    await sendTest(to.value.trim(), locale.value)
    sent.value = true
  } catch (error) {
    failure.value = {
      code: plutoMailErrorCode(error),
      text: errorText(error, 'pluto.mail.test.failed'),
    }
  } finally {
    sending.value = false
  }
}
</script>

<template>
  <PlutoMailStep
    :number="number"
    :title="
      mode === 'self'
        ? t('pluto.mail.test.selfTitle')
        : t('pluto.mail.test.anyoneTitle')
    "
    :description="
      mode === 'self'
        ? t('pluto.mail.test.selfDescription')
        : t('pluto.mail.test.anyoneDescription')
    "
    :state="state"
  >
    <UAlert
      v-if="lockedHint"
      :description="lockedHint"
      color="neutral"
      variant="subtle"
      icon="lucide:lock"
    />

    <template v-else>
      <UAlert
        v-if="mode === 'self' && !domainVerified"
        :description="t('pluto.mail.test.selfRule')"
        color="neutral"
        variant="subtle"
        icon="lucide:info"
      />

      <UFormField
        :label="t('pluto.mail.test.to')"
        :help="mode === 'anyone' ? t('pluto.mail.test.anyoneHelp') : undefined"
      >
        <UInput
          v-model="to"
          :placeholder="t('pluto.mail.test.toPlaceholder')"
          type="email"
          autocomplete="email"
          class="w-full sm:w-96"
          @keydown.enter.prevent="emailValid && !sending && send()"
        />
      </UFormField>

      <div>
        <UButton
          :loading="sending"
          :disabled="!emailValid"
          icon="lucide:send"
          @click="send"
        >
          {{ t('pluto.mail.test.send') }}
        </UButton>
      </div>

      <UAlert
        v-if="sent"
        :title="t('pluto.mail.test.sentTitle')"
        :description="
          status?.logOnly
            ? t('pluto.mail.test.sentDev')
            : t('pluto.mail.test.sentHint')
        "
        color="success"
        variant="subtle"
        icon="lucide:circle-check"
      />

      <UAlert
        v-if="failure?.code === 'test_sender_only'"
        :title="t('pluto.mail.test.senderRuleTitle')"
        :description="t('pluto.mail.test.senderRuleBody')"
        color="warning"
        variant="subtle"
        icon="lucide:triangle-alert"
      />
      <UAlert
        v-else-if="failure"
        :title="t('pluto.mail.test.failed')"
        :description="failure.text"
        color="error"
        variant="subtle"
        icon="lucide:circle-x"
      />
    </template>
  </PlutoMailStep>
</template>

<script setup lang="ts">
// Step 5: the From address. The address must belong to the verified domain.
// Pluto builds the environment lines. The admin copies them and restarts.
const { t } = usePlutoI18n()
const { status, domain } = usePlutoMail()
const config = useRuntimeConfig()

// "Untitled" is the default site name. It makes a poor sender name.
const siteName = String(config.public.websiteName ?? '')
const senderName = ref(siteName === 'Untitled' ? '' : siteName)
const localPart = ref('hello')
const replyTo = ref('')

const domainName = computed(() => domain.value?.name ?? '')
const verified = computed(() => domain.value !== null && plutoMailDomainState(domain.value.status) === 'verified')
const localValid = computed(() => /^[\w.+-]{1,64}$/.test(localPart.value.trim()))
const replyToValid = computed(() => replyTo.value.trim() === '' || isPlutoMailAddress(replyTo.value.trim()))

// A display name cannot hold angle brackets, quotes, commas or line breaks.
const cleanName = computed(() => senderName.value.replace(/[<>",;\r\n]/g, '').trim())

const address = computed(() => `${localPart.value.trim().toLowerCase()}@${domainName.value}`)
const fromValue = computed(() => (cleanName.value ? `${cleanName.value} <${address.value}>` : address.value))

const lines = computed(() => {
  const list = [plutoMailEnvLine('NUXT_PLUTO_MAIL_FROM', fromValue.value)]
  if (replyTo.value.trim() && replyToValid.value) {
    list.push(plutoMailEnvLine('NUXT_PLUTO_MAIL_REPLY_TO', replyTo.value.trim()))
  }
  return list
})

const state = computed(() => {
  if (status.value?.from) {
    return 'done'
  }
  return domain.value ? 'todo' : 'locked'
})
</script>

<template>
  <PlutoMailStep
    :number="5"
    :title="t('pluto.mail.from.title')"
    :description="t('pluto.mail.from.description')"
    :state="state"
  >
    <UAlert
      v-if="!domain"
      :description="t('pluto.mail.from.lockedDomain')"
      color="neutral"
      variant="subtle"
      icon="lucide:lock"
    />

    <template v-else>
      <UAlert
        v-if="!verified"
        :description="t('pluto.mail.from.notVerified')"
        color="warning"
        variant="subtle"
        icon="lucide:triangle-alert"
      />

      <p v-if="status?.from" class="text-sm">
        <span class="text-muted">{{ t('pluto.mail.from.current') }}</span>
        <code class="ml-1 break-all">{{ status.from }}</code>
      </p>

      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <UFormField :label="t('pluto.mail.from.name')" :help="t('pluto.mail.from.nameHelp')">
          <UInput v-model="senderName" autocomplete="off" class="w-full" />
        </UFormField>

        <UFormField :label="t('pluto.mail.from.address')" :error="localValid ? undefined : t('pluto.mail.from.addressInvalid')">
          <UInput v-model="localPart" autocomplete="off" class="w-full">
            <template #trailing>
              <span class="text-muted text-sm">@{{ domainName }}</span>
            </template>
          </UInput>
        </UFormField>

        <UFormField
          :label="t('pluto.mail.from.replyTo')"
          :help="t('pluto.mail.from.replyToHelp')"
          :error="replyToValid ? undefined : t('pluto.mail.from.replyToInvalid')"
        >
          <UInput v-model="replyTo" type="email" autocomplete="off" class="w-full" />
        </UFormField>
      </div>

      <template v-if="localValid && replyToValid">
        <p class="text-muted text-sm">{{ t('pluto.mail.from.envHint') }}</p>
        <PlutoMailEnvLines :lines="lines" />
      </template>
    </template>
  </PlutoMailStep>
</template>

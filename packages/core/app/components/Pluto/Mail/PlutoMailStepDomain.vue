<script setup lang="ts">
// Step 4: the sending domain. Pluto creates the domain in Resend and shows
// the DNS records. After the admin adds them, Pluto asks Resend to verify,
// and checks the status on a schedule: every 10 s at first, slower up to 60 s,
// and it stops after 10 minutes. "Check again" starts it again.
const { t } = usePlutoI18n()
const errorText = usePlutoErrorText()
const {
  keyState,
  domains,
  domain,
  createDomain,
  refreshDomain,
  verifyDomain,
  selectDomain,
} = usePlutoMail()

const name = ref('')
const region = ref<(typeof PLUTO_MAIL_REGIONS)[number]>(PLUTO_MAIL_REGIONS[0])
const creating = ref(false)
const checking = ref(false)
const polling = ref(false)
const timedOut = ref(false)
const failure = ref<string | null>(null)

const regionItems = computed(() =>
  PLUTO_MAIL_REGIONS.map((code) => ({
    label: t(`pluto.mail.domain.regions.${code}`),
    value: code,
  }))
)

const domainItems = computed(() =>
  domains.value.map((entry) => ({ label: entry.name, value: entry.id }))
)

const normalizedName = computed(() => name.value.trim().toLowerCase())
const nameValid = computed(() => isPlutoMailDomain(normalizedName.value))

const hasFullAccess = computed(() => keyState.value === 'full')
const domainState = computed(() =>
  domain.value ? plutoMailDomainState(domain.value.status) : null
)

const state = computed(() => {
  if (domainState.value === 'verified') {
    return 'done'
  }
  return hasFullAccess.value ? 'todo' : 'locked'
})

const statusBadge = computed(() => {
  switch (domainState.value) {
    case 'verified':
      return {
        label: t('pluto.mail.domain.statusVerified'),
        color: 'success' as const,
      }
    case 'failed':
      return {
        label: t('pluto.mail.domain.statusFailed'),
        color: 'error' as const,
      }
    default:
      return {
        label: t('pluto.mail.domain.statusPending'),
        color: 'warning' as const,
      }
  }
})

// One check: read the domain, report whether the work is done. The poller
// calls it, and so do the buttons.
async function checkOnce(): Promise<boolean> {
  if (!domain.value) {
    return true
  }
  const fresh = await refreshDomain(domain.value.id)
  return plutoMailDomainState(fresh.status) !== 'pending'
}

const poller = createPlutoMailPoller({
  check: checkOnce,
  onStop: (reason) => {
    polling.value = false
    timedOut.value = reason === 'timeout'
  },
})

function startPolling() {
  timedOut.value = false
  polling.value = true
  poller.start()
}

onBeforeUnmount(() => poller.stop())

// A domain from the list has no records yet: read it once. The poll does not
// start here. It starts when the admin asks Resend to verify, because the
// 10 minutes should not run out while the DNS records are still missing.
watch(
  () => domain.value?.id,
  async (id) => {
    poller.stop()
    timedOut.value = false
    if (id && domain.value?.records.length === 0) {
      try {
        await refreshDomain(id)
      } catch (error) {
        failure.value = errorText(error, 'pluto.mail.domain.verifyFailed')
      }
    }
  },
  { immediate: true }
)

async function add() {
  creating.value = true
  failure.value = null
  try {
    await createDomain(normalizedName.value, region.value)
    name.value = ''
  } catch (error) {
    failure.value = errorText(error, 'pluto.mail.domain.createFailed')
  } finally {
    creating.value = false
  }
}

// "Verify" and "Check again" ask Resend to look at the DNS now, read the
// result, and keep checking for 10 minutes.
async function verifyNow() {
  if (!domain.value) {
    return
  }
  checking.value = true
  failure.value = null
  try {
    await verifyDomain(domain.value.id)
    const done = await checkOnce()
    if (done) {
      poller.stop()
    } else {
      startPolling()
    }
  } catch (error) {
    failure.value = errorText(error, 'pluto.mail.domain.verifyFailed')
  } finally {
    checking.value = false
  }
}

function pick(id: string) {
  selectDomain(domains.value.find((entry) => entry.id === id) ?? null)
}
</script>

<template>
  <PlutoMailStep
    :number="4"
    :title="t('pluto.mail.domain.title')"
    :description="t('pluto.mail.domain.description')"
    :state="state"
  >
    <UAlert
      v-if="!hasFullAccess"
      :description="
        keyState === 'sending'
          ? t('pluto.mail.domain.lockedSending')
          : t('pluto.mail.domain.lockedKey')
      "
      color="neutral"
      variant="subtle"
      icon="lucide:lock"
    />

    <template v-else>
      <UFormField
        v-if="domainItems.length > 0"
        :label="t('pluto.mail.domain.existing')"
      >
        <USelect
          :model-value="domain?.id"
          :items="domainItems"
          :placeholder="t('pluto.mail.domain.existingPlaceholder')"
          class="w-full sm:w-96"
          @update:model-value="pick"
        />
      </UFormField>

      <div class="flex flex-col gap-3 sm:flex-row sm:items-end">
        <UFormField
          :label="t('pluto.mail.domain.name')"
          :help="t('pluto.mail.domain.nameHelp')"
          class="sm:w-80"
        >
          <UInput
            v-model="name"
            placeholder="example.com"
            autocomplete="off"
            class="w-full"
            @keydown.enter.prevent="nameValid && !creating && add()"
          />
        </UFormField>

        <UFormField :label="t('pluto.mail.domain.region')" class="sm:w-56">
          <USelect v-model="region" :items="regionItems" class="w-full" />
        </UFormField>

        <UButton
          :loading="creating"
          :disabled="!nameValid"
          icon="lucide:globe"
          @click="add"
        >
          {{ t('pluto.mail.domain.add') }}
        </UButton>
      </div>

      <UAlert
        v-if="failure"
        :description="failure"
        color="error"
        variant="subtle"
        icon="lucide:circle-x"
      />

      <template v-if="domain">
        <div class="flex flex-wrap items-center gap-2">
          <span class="font-medium">{{ domain.name }}</span>
          <UBadge
            :label="statusBadge.label"
            :color="statusBadge.color"
            variant="subtle"
          />
          <UBadge
            v-if="polling"
            :label="t('pluto.mail.domain.polling')"
            color="neutral"
            variant="outline"
            icon="lucide:loader-circle"
          />
        </div>

        <p v-if="domainState !== 'verified'" class="text-muted text-sm">
          {{ t('pluto.mail.domain.recordsHint') }}
        </p>

        <PlutoMailDomainRecords :records="domain.records" />

        <UAlert
          v-if="domainState === 'verified'"
          :title="t('pluto.mail.domain.verifiedTitle')"
          :description="t('pluto.mail.domain.verifiedHint')"
          color="success"
          variant="subtle"
          icon="lucide:circle-check"
        />
        <UAlert
          v-else-if="domainState === 'failed'"
          :title="t('pluto.mail.domain.failedTitle')"
          :description="t('pluto.mail.domain.failedHint')"
          color="error"
          variant="subtle"
          icon="lucide:circle-x"
        />
        <UAlert
          v-else-if="timedOut"
          :title="t('pluto.mail.domain.timedOutTitle')"
          :description="t('pluto.mail.domain.timedOutHint')"
          color="warning"
          variant="subtle"
          icon="lucide:clock"
        />

        <div v-if="domainState !== 'verified'" class="flex flex-wrap gap-2">
          <UButton
            :loading="checking"
            icon="lucide:shield-check"
            @click="verifyNow"
          >
            {{
              polling || timedOut || domainState === 'failed'
                ? t('pluto.mail.domain.checkAgain')
                : t('pluto.mail.domain.verify')
            }}
          </UButton>
        </div>
      </template>
    </template>
  </PlutoMailStep>
</template>

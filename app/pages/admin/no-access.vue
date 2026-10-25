<script setup lang="ts">
// The page for a signed-in user with no capability. The route guard sends the
// user here (see `staffDecision`). The `reason=error` query means the
// capabilities failed to load. The frame is PlutoAdminAuthCard. See the
// admin-shell skill.
import { ADMIN_HOME_PATH, ADMIN_NO_ACCESS_PATH, isStaff, safeRedirect } from '../../composables/internal/admin-shell'

definePageMeta({ layout: 'auth' })

const { t } = usePlutoI18n()
const route = useRoute()
const auth = usePlutoAuth()
const permissions = usePlutoPermissions()
const known = usePlutoCapabilitiesKnown()

useHead({ title: () => t('pluto.noAccess.title') })

function firstString(value: unknown): unknown {
  return Array.isArray(value) ? value[0] : value
}

const failed = ref(route.query.reason === 'error')
const trying = ref(false)
const redirect = computed(() => safeRedirect(firstString(route.query.redirect)))
const heading = computed(() => (failed.value ? t('pluto.noAccess.errorTitle') : t('pluto.noAccess.title')))
const description = computed(() =>
  failed.value ? t('pluto.noAccess.errorDescription') : t('pluto.noAccess.description')
)

/** Loads the capabilities again. Staff go on. Other users stay on this page. */
async function tryAgain() {
  trying.value = true
  try {
    permissions.clear()
    await permissions.ensureLoaded(auth.user.value?.id ?? '')
    known.value = permissions.loaded.value
    failed.value = false
    if (isStaff(permissions.hasDriver.value, permissions.granted.value)) {
      await navigateTo(redirect.value || ADMIN_HOME_PATH, { replace: true })
      return
    }
    // Keep the wanted path, and drop the error reason from the URL.
    await navigateTo(
      redirect.value
        ? `${ADMIN_NO_ACCESS_PATH}?redirect=${encodeURIComponent(redirect.value)}`
        : ADMIN_NO_ACCESS_PATH,
      { replace: true }
    )
  } catch {
    failed.value = true
  } finally {
    trying.value = false
  }
}
</script>

<template>
  <PlutoAdminAuthCard :title="heading">
    <UAlert
      :description="description"
      :color="failed ? 'error' : 'warning'"
      :icon="failed ? 'lucide:circle-alert' : 'lucide:lock'"
      variant="subtle"
    />

    <div class="flex flex-col gap-y-2">
      <UButton
        :label="t('pluto.noAccess.tryAgain')"
        :loading="trying"
        icon="lucide:refresh-cw"
        block
        @click="tryAgain"
      />
      <UButton
        :label="t('pluto.noAccess.goToSite')"
        icon="lucide:globe"
        to="/"
        color="neutral"
        variant="outline"
        external
        block
      />
      <UButton
        :label="t('pluto.noAccess.signOut')"
        icon="lucide:log-out"
        color="neutral"
        variant="ghost"
        block
        @click="auth.signOut()"
      />
    </div>
  </PlutoAdminAuthCard>
</template>

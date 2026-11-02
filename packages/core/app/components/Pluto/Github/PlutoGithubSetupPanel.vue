<script setup lang="ts">
// The setup check of the GitHub sign-in: the Create button, the Install link
// and the docs link first, then the checklist, folded. The checklist opens by
// itself only when the panel has no button to show. The login card (`variant="login"`) and the
// GitHub settings page (`variant="settings"`) both use it. The file lives
// under `app/` so Tailwind scans it. The panel holds no secret: the status
// route answers booleans and public names only. See the git-cms skill.
import type { PlutoGithubSetupStatus } from '../../../../modules/pluto-github/runtime/app/composables/pluto-github-setup'
import {
  CMS_SETUP_START_URL,
  usePlutoGithubSetup,
} from '../../../../modules/pluto-github/runtime/app/composables/pluto-github-setup'

const props = withDefaults(
  defineProps<{
    variant?: 'login' | 'settings'
    /** Use a status that the parent already has, instead of a new read. */
    status?: PlutoGithubSetupStatus | null
  }>(),
  {
    variant: 'login',
    status: undefined,
  }
)

const DOCS_URL = 'https://pluto.vulmix.dev/docs/start-here/deploy'

const { t } = usePlutoI18n()
const setup = usePlutoGithubSetup()
const appSlug = (
  useRuntimeConfig().public as {
    plutoGithub?: {
      appSlug?: string
    }
  }
).plutoGithub?.appSlug

const current = computed(() =>
  props.status === undefined ? setup.status.value : props.status
)
const checks = computed(() => current.value?.checks ?? [])
const missing = computed(() => checks.value.some((check) => !check.ok))
const installCheck = computed(() =>
  checks.value.find((check) => check.id === 'installation')
)
const installUrl = computed(() =>
  appSlug
    ? `https://github.com/apps/${encodeURIComponent(appSlug)}/installations/new`
    : ''
)
const isDev = import.meta.dev

const doneCount = computed(
  () => checks.value.filter((check) => check.ok).length
)
const hasAction = computed(() =>
  Boolean(
    current.value?.canCreateApp ||
    (installCheck.value && !installCheck.value.ok && installUrl.value)
  )
)
// The settings page reads the status after the mount, so follow it.
const checklistOpen = ref(false)
watch(
  hasAction,
  (value) => {
    checklistOpen.value = !value
  },
  { immediate: true }
)

const copied = ref(false)
async function copyCallback() {
  const url = current.value?.callbackUrl
  if (!url) {
    return
  }
  try {
    await navigator.clipboard.writeText(url)
    copied.value = true
    setTimeout(() => {
      copied.value = false
    }, 2000)
  } catch {
    // The field is selectable, so the user can copy by hand.
  }
}
</script>

<template>
  <div v-if="current" class="flex flex-col gap-y-4">
    <UAlert
      v-if="current.ready && variant === 'settings' && !missing"
      :title="t('pluto.github.setup.ready.title')"
      :description="t('pluto.github.setup.ready.description')"
      color="success"
      variant="subtle"
      icon="lucide:circle-check"
    />

    <UAlert
      v-else-if="!current.ready && variant === 'login'"
      :title="t('pluto.github.setup.title')"
      :description="t('pluto.github.setup.intro')"
      color="warning"
      variant="subtle"
      icon="lucide:triangle-alert"
    />

    <div
      v-if="
        current.canCreateApp ||
        (installCheck && !installCheck.ok && installUrl) ||
        !current.ready
      "
      class="flex flex-col gap-y-2"
    >
      <UButton
        v-if="current.canCreateApp"
        :to="CMS_SETUP_START_URL"
        :label="t('pluto.github.setup.create')"
        :color="current.ready ? 'neutral' : 'primary'"
        :variant="current.ready ? 'outline' : 'solid'"
        icon="pluto:github"
        class="w-full justify-center"
        external
      />
      <UButton
        v-if="installCheck && !installCheck.ok && installUrl"
        :to="installUrl"
        :label="t('pluto.github.setup.install')"
        icon="lucide:external-link"
        target="_blank"
        rel="noopener noreferrer"
        color="neutral"
        variant="outline"
        class="w-full justify-center"
      />
      <UButton
        v-if="!current.ready"
        :to="DOCS_URL"
        :label="t('pluto.github.setup.docs')"
        icon="lucide:book-open"
        target="_blank"
        rel="noopener noreferrer"
        color="neutral"
        variant="link"
        class="justify-center"
      />
    </div>

    <p
      v-if="variant === 'settings' && current.canCreateApp && isDev"
      class="text-muted text-sm"
    >
      {{ t('pluto.github.setup.devNote') }}
    </p>

    <UCollapsible v-if="checks.length > 0" v-model:open="checklistOpen">
      <UButton
        :label="t('pluto.github.setup.checklist')"
        color="neutral"
        variant="ghost"
        class="w-full justify-between"
      >
        <template #trailing>
          <span class="text-muted ml-auto text-xs font-normal">
            {{
              t('pluto.github.setup.progress', {
                done: doneCount,
                total: checks.length,
              })
            }}
          </span>
          <UIcon
            :name="checklistOpen ? 'lucide:chevron-up' : 'lucide:chevron-down'"
            class="size-4"
          />
        </template>
      </UButton>
      <template #content>
        <ul
          :aria-label="t('pluto.github.setup.checklist')"
          class="flex flex-col gap-y-3 pt-3"
        >
          <li
            v-for="check in checks"
            :key="check.id"
            class="flex items-start gap-x-2"
          >
            <UIcon
              :name="check.ok ? 'lucide:circle-check' : 'lucide:circle-x'"
              :class="check.ok ? 'text-success' : 'text-error'"
              class="mt-0.5 size-5 shrink-0"
            />
            <div class="min-w-0">
              <p class="text-sm font-medium">
                {{ t(`pluto.github.setup.checks.${check.id}.title`) }}
                <span class="sr-only">{{
                  check.ok
                    ? t('pluto.github.setup.done')
                    : t('pluto.github.setup.missing')
                }}</span>
              </p>
              <p v-if="!check.ok" class="text-muted text-sm">
                {{ t(`pluto.github.setup.checks.${check.id}.fix`) }}
              </p>
            </div>
          </li>
        </ul>
      </template>
    </UCollapsible>

    <div
      v-if="variant === 'settings' && current.callbackUrl"
      class="flex flex-col gap-y-1.5"
    >
      <label for="pluto-github-callback-url" class="text-sm font-medium">{{
        t('pluto.github.setup.callbackUrl')
      }}</label>
      <div class="flex gap-x-2">
        <UInput
          id="pluto-github-callback-url"
          :model-value="current.callbackUrl"
          class="min-w-0 flex-1"
          readonly
        />
        <UButton
          :icon="copied ? 'lucide:check' : 'lucide:copy'"
          :aria-label="t('pluto.github.setup.copy')"
          color="neutral"
          variant="outline"
          @click="copyCallback"
        />
      </div>
      <p class="text-muted text-sm">
        {{ t('pluto.github.setup.callbackHint') }}
      </p>
    </div>
  </div>
  <USkeleton
    v-else-if="status === undefined && setup.pending.value"
    class="h-24 w-full"
  />
</template>

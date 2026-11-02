<script setup lang="ts">
// The Deploy tab of Settings (`/admin/settings/deploy`). The CMS module adds
// the route with `extendPages`, and the client plugin adds the tab. It puts
// the site on a host:
//
// - The whole app (the site and the admin): Vercel, Netlify, a Node host. A
//   card opens the import page of the host for this repo.
// - A static site (the admin stays on the computer): GitHub Pages and
//   Cloudflare Pages. In local mode, "Set up GitHub Pages" writes the
//   workflow, commits it, and turns Pages on with the GitHub CLI. It changes
//   a real repo, so a dialog names the repo first.
// - The domain: see PlutoGithubDeployDomain.
//
// The file lives under `app/` so Tailwind scans it. See the git-cms skill.
import type {
  PlutoDeployStatus,
  PlutoPagesSetupResult,
} from '../../../../modules/pluto-github/runtime/shared/deploy'
import { usePlutoGithubLocalGit } from '../../../../modules/pluto-github/runtime/app/composables/pluto-github-local-git'

const DOCS_URL = 'https://pluto.vulmix.dev/docs/start-here/deploy'

const { t } = usePlutoI18n()
const errorText = usePlutoErrorText()
const localGit = usePlutoGithubLocalGit()

useHead({
  title: () =>
    `${t('pluto.settings.tabs.deploy')} - ${t('pluto.pages.settings')}`,
})

const status = ref<PlutoDeployStatus | null>(null)
const loadError = ref('')
const loading = ref(true)

async function load() {
  loading.value = true
  loadError.value = ''
  try {
    status.value = await $fetch<PlutoDeployStatus>(
      '/api/_pluto/github/deploy/status'
    )
  } catch (error) {
    loadError.value = errorText(error)
  } finally {
    loading.value = false
  }
}
onMounted(load)

const repoUrl = computed(() =>
  status.value?.repo ? `https://github.com/${status.value.repo}` : ''
)

/** The full-site hosts. Each link opens the import page of the host. */
const hosts = computed(() => [
  {
    id: 'vercel',
    icon: 'i-lucide-triangle',
    to: repoUrl.value
      ? `https://vercel.com/new/import?s=${encodeURIComponent(repoUrl.value)}`
      : 'https://vercel.com/new',
  },
  {
    id: 'netlify',
    icon: 'i-lucide-diamond',
    to: 'https://app.netlify.com/start',
  },
  {
    id: 'node',
    icon: 'i-lucide-server',
    to: `${DOCS_URL}#a-node-host`,
  },
])

// --- GitHub Pages ------------------------------------------------------------

const settingUp = ref(false)
const setupError = ref('')
const setupResult = ref<PlutoPagesSetupResult | null>(null)

const pages = computed(() => status.value?.pages)
const pagesReady = computed(
  () =>
    Boolean(status.value?.workflow.current) &&
    pages.value?.state === 'on' &&
    pages.value.source === 'workflow'
)
const pagesUrl = computed(
  () => pages.value?.url || status.value?.pagesUrl || ''
)
const pagesSettingsUrl = computed(() =>
  repoUrl.value ? `${repoUrl.value}/settings/pages` : ''
)

/** One line for the state of Pages on GitHub. */
const pagesLine = computed(() => {
  const current = pages.value
  if (!current) {
    return ''
  }
  if (current.state === 'on') {
    return current.source === 'workflow'
      ? t('pluto.github.deploy.pages.state.on')
      : t('pluto.github.deploy.pages.state.legacy')
  }
  if (current.state === 'off') {
    return t('pluto.github.deploy.pages.state.off')
  }
  return t(`pluto.github.deploy.pages.reason.${current.reason ?? 'error'}`)
})

const confirmOpen = ref(false)

async function setupPages() {
  confirmOpen.value = false
  settingUp.value = true
  setupError.value = ''
  try {
    const result = await $fetch<PlutoPagesSetupResult>(
      '/api/_pluto/github/deploy/pages',
      { method: 'POST' }
    )
    setupResult.value = result
    status.value = result.status
    // The workflow commit is a new commit to push: the Git badge counts it.
    localGit.refresh()
  } catch (error) {
    setupError.value = errorText(error)
  } finally {
    settingUp.value = false
  }
}

const showWorkflow = ref(false)
const copied = ref('')
async function copy(id: string, text: string) {
  try {
    await navigator.clipboard.writeText(text)
    copied.value = id
    setTimeout(() => {
      if (copied.value === id) {
        copied.value = ''
      }
    }, 2000)
  } catch {
    // The text is selectable, so the user can copy it by hand.
  }
}

const cloudflare = {
  command: 'npx nuxt generate',
  output: '.output/public',
  url: 'https://dash.cloudflare.com/?to=/:account/workers-and-pages/create/pages',
}
</script>

<template>
  <div class="flex flex-col gap-y-8">
    <div>
      <h2 class="text-xl font-semibold">
        {{ t('pluto.settings.tabs.deploy') }}
      </h2>
      <p class="text-muted text-sm">
        {{ t('pluto.github.deploy.intro') }}
      </p>
    </div>

    <UAlert
      v-if="loadError"
      :title="t('pluto.github.deploy.error')"
      :description="loadError"
      :actions="[
        {
          label: t('pluto.common.tryAgain'),
          color: 'neutral',
          variant: 'outline',
          onClick: load,
        },
      ]"
      color="error"
      icon="i-lucide-circle-x"
      variant="subtle"
    />

    <!-- The whole app: the site and the admin. -->
    <section class="flex flex-col gap-y-3">
      <div>
        <h3 class="font-semibold">{{ t('pluto.github.deploy.full.title') }}</h3>
        <p class="text-muted text-sm">
          {{ t('pluto.github.deploy.full.description') }}
        </p>
      </div>
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <UCard v-for="host in hosts" :key="host.id">
          <div class="flex h-full flex-col gap-y-3">
            <div class="flex items-center gap-2">
              <UIcon :name="host.icon" class="size-5" />
              <span class="font-semibold">
                {{ t(`pluto.github.deploy.hosts.${host.id}.name`) }}
              </span>
            </div>
            <p class="text-muted grow text-sm">
              {{ t(`pluto.github.deploy.hosts.${host.id}.description`) }}
            </p>
            <UButton
              :label="t(`pluto.github.deploy.hosts.${host.id}.action`)"
              :to="host.to"
              :color="host.id === 'node' ? 'neutral' : 'primary'"
              :variant="host.id === 'node' ? 'outline' : 'solid'"
              class="self-start"
              target="_blank"
              trailing-icon="i-lucide-external-link"
            />
          </div>
        </UCard>
      </div>
      <p class="text-muted text-sm">
        {{ t('pluto.github.deploy.full.after') }}
      </p>
    </section>

    <!-- A static site: the admin stays on the computer. -->
    <section class="flex flex-col gap-y-3">
      <div>
        <h3 class="font-semibold">
          {{ t('pluto.github.deploy.static.title') }}
        </h3>
        <p class="text-muted text-sm">
          {{ t('pluto.github.deploy.static.description') }}
        </p>
      </div>

      <UCard>
        <div class="flex flex-col gap-y-4">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div class="flex items-center gap-2">
              <UIcon name="i-pluto-github" class="size-5" />
              <span class="font-semibold">
                {{ t('pluto.github.deploy.pages.name') }}
              </span>
              <UBadge
                v-if="pagesReady"
                :label="t('pluto.github.deploy.pages.ready')"
                color="success"
                variant="subtle"
              />
            </div>
            <UButton
              v-if="pagesReady && pagesUrl"
              :label="t('pluto.github.deploy.pages.open')"
              :to="pagesUrl"
              color="neutral"
              target="_blank"
              trailing-icon="i-lucide-external-link"
              variant="outline"
            />
          </div>

          <p class="text-muted text-sm">
            {{ t('pluto.github.deploy.pages.description') }}
          </p>

          <USkeleton v-if="loading && !status" class="h-16 w-full" />

          <!-- Local mode: the checks and the Set up button. -->
          <template v-else-if="status?.local">
            <ul class="flex flex-col gap-y-2 text-sm">
              <li class="flex items-start gap-2">
                <UIcon
                  :name="
                    status.workflow.current
                      ? 'i-lucide-circle-check'
                      : 'i-lucide-circle-dashed'
                  "
                  :class="
                    status.workflow.current ? 'text-success' : 'text-muted'
                  "
                  class="mt-0.5 size-4 shrink-0"
                />
                <span>
                  {{
                    status.workflow.current
                      ? t('pluto.github.deploy.pages.workflow.done')
                      : status.workflow.exists
                        ? t('pluto.github.deploy.pages.workflow.old')
                        : t('pluto.github.deploy.pages.workflow.missing')
                  }}
                  <code class="text-xs">{{ status.workflow.path }}</code>
                </span>
              </li>
              <li class="flex items-start gap-2">
                <UIcon
                  :name="
                    pages?.state === 'on' && pages.source === 'workflow'
                      ? 'i-lucide-circle-check'
                      : 'i-lucide-circle-dashed'
                  "
                  :class="
                    pages?.state === 'on' && pages.source === 'workflow'
                      ? 'text-success'
                      : 'text-muted'
                  "
                  class="mt-0.5 size-4 shrink-0"
                />
                <span>{{ pagesLine }}</span>
              </li>
            </ul>

            <div class="flex flex-wrap items-center gap-2">
              <UButton
                v-if="!pagesReady"
                :label="t('pluto.github.deploy.pages.setup')"
                :loading="settingUp"
                :disabled="!status.repo"
                icon="i-lucide-wand-sparkles"
                @click="confirmOpen = true"
              />
              <UButton
                v-if="pages?.state !== 'on' || pages.source !== 'workflow'"
                :label="t('pluto.github.deploy.pages.settings')"
                :to="pagesSettingsUrl"
                :disabled="!pagesSettingsUrl"
                color="neutral"
                target="_blank"
                trailing-icon="i-lucide-external-link"
                variant="outline"
              />
              <UButton
                :label="
                  showWorkflow
                    ? t('pluto.github.deploy.pages.hideWorkflow')
                    : t('pluto.github.deploy.pages.showWorkflow')
                "
                color="neutral"
                variant="ghost"
                @click="showWorkflow = !showWorkflow"
              />
            </div>

            <UAlert
              v-if="setupError"
              :description="setupError"
              color="error"
              icon="i-lucide-circle-x"
              variant="subtle"
            />
            <UAlert
              v-else-if="setupResult"
              :title="
                setupResult.pagesOn
                  ? t('pluto.github.deploy.pages.done.title')
                  : t('pluto.github.deploy.pages.partial.title')
              "
              :description="
                setupResult.pagesOn
                  ? t('pluto.github.deploy.pages.done.description')
                  : t('pluto.github.deploy.pages.partial.description')
              "
              :color="setupResult.pagesOn ? 'success' : 'warning'"
              :icon="
                setupResult.pagesOn
                  ? 'i-lucide-circle-check'
                  : 'i-lucide-triangle-alert'
              "
              variant="subtle"
            />
          </template>

          <!-- Not local: the setup by hand. -->
          <template v-else-if="status">
            <ol class="list-decimal space-y-1 pl-5 text-sm">
              <li>{{ t('pluto.github.deploy.pages.manual.step1') }}</li>
              <li>
                {{ t('pluto.github.deploy.pages.manual.step2') }}
                <ULink
                  v-if="pagesSettingsUrl"
                  :to="pagesSettingsUrl"
                  class="text-primary"
                  target="_blank"
                >
                  {{ t('pluto.github.deploy.pages.settings') }}
                </ULink>
              </li>
              <li>{{ t('pluto.github.deploy.pages.manual.step3') }}</li>
            </ol>
          </template>

          <div
            v-if="status && (showWorkflow || !status.local)"
            class="flex flex-col gap-y-2"
          >
            <div class="flex items-center justify-between gap-2">
              <code class="text-muted text-xs">{{ status.workflow.path }}</code>
              <UButton
                :label="
                  copied === 'workflow'
                    ? t('pluto.common.copied')
                    : t('pluto.common.copy')
                "
                :icon="
                  copied === 'workflow' ? 'i-lucide-check' : 'i-lucide-copy'
                "
                color="neutral"
                size="xs"
                variant="outline"
                @click="copy('workflow', status.workflow.text)"
              />
            </div>
            <pre
              class="bg-elevated max-h-80 overflow-auto rounded-md p-3 text-xs"
              >{{ status.workflow.text }}</pre>
          </div>

          <p class="text-muted text-xs">
            {{ t('pluto.github.deploy.pages.nodeAdmin') }}
          </p>
        </div>
      </UCard>

      <UCard>
        <div class="flex flex-col gap-y-3">
          <div class="flex items-center gap-2">
            <UIcon name="i-lucide-cloud" class="size-5" />
            <span class="font-semibold">
              {{ t('pluto.github.deploy.cloudflare.name') }}
            </span>
          </div>
          <p class="text-muted text-sm">
            {{ t('pluto.github.deploy.cloudflare.description') }}
          </p>
          <dl class="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-2">
            <dt class="text-muted text-sm">
              {{ t('pluto.github.deploy.cloudflare.command') }}
            </dt>
            <dd class="flex items-center gap-2">
              <code class="text-sm">{{ cloudflare.command }}</code>
              <UButton
                :aria-label="t('pluto.common.copy')"
                :icon="
                  copied === 'command' ? 'i-lucide-check' : 'i-lucide-copy'
                "
                color="neutral"
                size="xs"
                variant="ghost"
                @click="copy('command', cloudflare.command)"
              />
            </dd>
            <dt class="text-muted text-sm">
              {{ t('pluto.github.deploy.cloudflare.output') }}
            </dt>
            <dd class="flex items-center gap-2">
              <code class="text-sm">{{ cloudflare.output }}</code>
              <UButton
                :aria-label="t('pluto.common.copy')"
                :icon="copied === 'output' ? 'i-lucide-check' : 'i-lucide-copy'"
                color="neutral"
                size="xs"
                variant="ghost"
                @click="copy('output', cloudflare.output)"
              />
            </dd>
          </dl>
          <UButton
            :label="t('pluto.github.deploy.cloudflare.action')"
            :to="cloudflare.url"
            class="self-start"
            color="neutral"
            target="_blank"
            trailing-icon="i-lucide-external-link"
            variant="outline"
          />
        </div>
      </UCard>
    </section>

    <PlutoGithubDeployDomain
      v-if="status"
      :status="status"
      @status="status = $event"
    />

    <UModal
      v-if="status"
      v-model:open="confirmOpen"
      :title="t('pluto.github.deploy.confirm.title')"
      :description="
        t('pluto.github.deploy.confirm.description', { repo: status.repo })
      "
    >
      <template #body>
        <ul class="flex list-disc flex-col gap-y-1 pl-5 text-sm">
          <li>
            {{
              t('pluto.github.deploy.confirm.write', {
                path: status.workflow.path,
              })
            }}
          </li>
          <li>
            {{ t('pluto.github.deploy.confirm.pages', { repo: status.repo }) }}
          </li>
          <li>{{ t('pluto.github.deploy.confirm.push') }}</li>
        </ul>
      </template>
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton
            :label="t('pluto.common.cancel')"
            color="neutral"
            variant="ghost"
            @click="confirmOpen = false"
          />
          <UButton
            :label="t('pluto.github.deploy.confirm.action')"
            icon="i-lucide-wand-sparkles"
            @click="setupPages"
          />
        </div>
      </template>
    </UModal>
  </div>
</template>

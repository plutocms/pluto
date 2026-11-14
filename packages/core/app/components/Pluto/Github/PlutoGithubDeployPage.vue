<script setup lang="ts">
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

const hosts = computed(() => [
  {
    id: 'vercel' as const,
    icon: 'i-lucide-triangle',
    to: repoUrl.value
      ? `https://vercel.com/new/import?s=${encodeURIComponent(repoUrl.value)}`
      : 'https://vercel.com/new',
  },
  {
    id: 'netlify' as const,
    icon: 'i-lucide-diamond',
    to: 'https://app.netlify.com/start',
  },
  {
    id: 'node' as const,
    icon: 'i-lucide-server',
    to: `${DOCS_URL}#a-node-host`,
  },
])

const deploy = computed(() => status.value?.deploy)
const online = computed(() => deploy.value?.state === 'success')
const siteUrl = computed(
  () => deploy.value?.url || status.value?.pagesUrl || ''
)
const pagesSettingsUrl = computed(() =>
  repoUrl.value ? `${repoUrl.value}/settings/pages` : ''
)
const runsUrl = computed(() => {
  const file = status.value?.workflow.path.split('/').at(-1)
  return repoUrl.value && file
    ? `${repoUrl.value}/actions/workflows/${file}`
    : ''
})

const pushed = computed(
  () =>
    Boolean(status.value?.local && status.value.workflow.current) &&
    !localGit.ahead.value
)

const deployLine = computed(() => {
  const current = deploy.value
  if (!current) {
    return ''
  }
  return current.state === 'success'
    ? t('pluto.github.deploy.pages.deploy.success', { url: siteUrl.value })
    : t(`pluto.github.deploy.pages.deploy.${current.state}`)
})

const DEPLOY_ICONS = {
  success: ['i-lucide-circle-check', 'text-success'],
  failure: ['i-lucide-circle-x', 'text-error'],
  pending: ['i-lucide-loader-circle', 'text-primary animate-spin'],
  none: ['i-lucide-circle-dashed', 'text-muted'],
  unknown: ['i-lucide-circle-help', 'text-muted'],
} as const
const deployIcon = computed(
  () => DEPLOY_ICONS[deploy.value?.state ?? 'unknown']
)

const confirmOpen = ref(false)
const settingUp = ref(false)
const setupError = ref('')

async function setupPages() {
  confirmOpen.value = false
  settingUp.value = true
  setupError.value = ''
  try {
    const result = await $fetch<PlutoPagesSetupResult>(
      '/api/_pluto/github/deploy/pages',
      { method: 'POST' }
    )
    status.value = result.status
    localGit.refresh()
  } catch (error) {
    setupError.value = errorText(error)
  } finally {
    settingUp.value = false
  }
}

const removeOpen = ref(false)
const removing = ref(false)
const removeError = ref('')
const removed = ref(false)

async function removePages() {
  removeOpen.value = false
  removing.value = true
  removeError.value = ''
  try {
    const result = await $fetch<PlutoPagesSetupResult>(
      '/api/_pluto/github/deploy/pages',
      { method: 'DELETE' }
    )
    status.value = result.status
    removed.value = true
    localGit.refresh()
  } catch (error) {
    removeError.value = errorText(error)
  } finally {
    removing.value = false
  }
}

const pushError = ref('')
async function push() {
  pushError.value = ''
  try {
    await localGit.push()
  } catch (error) {
    pushError.value = errorText(error)
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
  } catch {}
}

const cloudflare = {
  command: 'npx nuxt generate',
  output: '.output/public',
  url: 'https://dash.cloudflare.com/?to=/:account/workers-and-pages/create/pages',
}
</script>

<template>
  <div class="flex flex-col gap-y-6 lg:gap-y-8">
    <p class="text-muted text-sm">
      {{ t('pluto.github.deploy.intro') }}
    </p>

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

    <section class="flex flex-col gap-y-3">
      <div>
        <h2 class="font-semibold">{{ t('pluto.github.deploy.full.title') }}</h2>
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
              <PlutoCodeText
                :text="t(`pluto.github.deploy.hosts.${host.id}.description`)"
              />
            </p>
            <UButton
              :label="t(`pluto.github.deploy.hosts.${host.id}.action`)"
              :to="host.to"
              :color="host.id === 'node' ? 'neutral' : 'primary'"
              :variant="host.id === 'node' ? 'outline' : 'solid'"
              class="self-start"
              target="_blank"
              trailing-icon="i-lucide-arrow-up-right"
            />
          </div>
        </UCard>
      </div>
      <p class="text-muted text-sm">
        <PlutoCodeText :text="t('pluto.github.deploy.full.after')" />
      </p>
    </section>

    <section class="flex flex-col gap-y-3">
      <div>
        <h2 class="font-semibold">
          {{ t('pluto.github.deploy.static.title') }}
        </h2>
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
                v-if="online"
                :label="t('pluto.github.deploy.pages.online')"
                color="success"
                variant="subtle"
              />
            </div>
            <UButton
              v-if="online && siteUrl"
              :label="t('pluto.github.deploy.pages.open')"
              :to="siteUrl"
              color="neutral"
              target="_blank"
              trailing-icon="i-lucide-arrow-up-right"
              variant="outline"
            />
          </div>

          <p class="text-muted text-sm">
            {{ t('pluto.github.deploy.pages.description') }}
          </p>

          <USkeleton v-if="loading && !status" class="h-16 w-full" />

          <template v-else-if="status">
            <ol class="flex flex-col gap-y-4 text-sm">
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
                <div class="flex min-w-0 flex-col items-start gap-2">
                  <span v-if="status.local">
                    {{
                      status.workflow.current
                        ? t('pluto.github.deploy.pages.workflow.done')
                        : status.workflow.exists
                          ? t('pluto.github.deploy.pages.workflow.old')
                          : t('pluto.github.deploy.pages.workflow.missing')
                    }}
                    <code class="text-xs">{{ status.workflow.path }}</code>
                  </span>
                  <span v-else>
                    {{ t('pluto.github.deploy.pages.workflow.manual') }}
                    <code class="text-xs">{{ status.workflow.path }}</code>
                  </span>
                  <div v-if="status.local" class="flex flex-wrap gap-2">
                    <UButton
                      v-if="!status.workflow.current"
                      :label="t('pluto.github.deploy.pages.setup')"
                      :loading="settingUp"
                      icon="i-lucide-file-plus"
                      size="sm"
                      @click="confirmOpen = true"
                    />
                    <UButton
                      :label="
                        showWorkflow
                          ? t('pluto.github.deploy.pages.hideWorkflow')
                          : t('pluto.github.deploy.pages.showWorkflow')
                      "
                      color="neutral"
                      size="sm"
                      variant="ghost"
                      @click="showWorkflow = !showWorkflow"
                    />
                  </div>
                  <UAlert
                    v-if="setupError"
                    :description="setupError"
                    class="w-full"
                    color="error"
                    icon="i-lucide-circle-x"
                    variant="subtle"
                  />
                </div>
              </li>

              <li class="flex items-start gap-2">
                <UIcon
                  :name="
                    online ? 'i-lucide-circle-check' : 'i-lucide-circle-dashed'
                  "
                  :class="online ? 'text-success' : 'text-muted'"
                  class="mt-0.5 size-4 shrink-0"
                />
                <div class="flex flex-col items-start gap-2">
                  <span>{{ t('pluto.github.deploy.pages.source') }}</span>
                  <UButton
                    :label="t('pluto.github.deploy.pages.settings')"
                    :to="pagesSettingsUrl"
                    :disabled="!pagesSettingsUrl"
                    color="neutral"
                    size="sm"
                    target="_blank"
                    trailing-icon="i-lucide-arrow-up-right"
                    variant="outline"
                  />
                </div>
              </li>

              <li class="flex items-start gap-2">
                <UIcon
                  :name="
                    pushed ? 'i-lucide-circle-check' : 'i-lucide-circle-dashed'
                  "
                  :class="pushed ? 'text-success' : 'text-muted'"
                  class="mt-0.5 size-4 shrink-0"
                />
                <div class="flex flex-col items-start gap-2">
                  <span>{{ t('pluto.github.deploy.pages.push') }}</span>
                  <template v-if="status.local && localGit.ahead.value">
                    <UButton
                      :label="`${t('pluto.github.local.push')} · ${t('pluto.github.local.ahead', localGit.ahead.value)}`"
                      :loading="localGit.pushing.value"
                      icon="i-lucide-upload"
                      size="sm"
                      @click="push"
                    />
                    <UAlert
                      v-if="pushError"
                      :description="pushError"
                      class="w-full"
                      color="error"
                      icon="i-lucide-circle-x"
                      variant="subtle"
                    />
                  </template>
                </div>
              </li>

              <li class="flex items-start gap-2">
                <UIcon
                  :name="deployIcon[0]"
                  :class="deployIcon[1]"
                  class="mt-0.5 size-4 shrink-0"
                />
                <div class="flex flex-col items-start gap-2">
                  <span>{{ deployLine }}</span>
                  <div class="flex flex-wrap gap-2">
                    <UButton
                      :label="t('pluto.github.deploy.pages.check')"
                      :loading="loading"
                      color="neutral"
                      icon="i-lucide-refresh-cw"
                      size="sm"
                      variant="outline"
                      @click="load"
                    />
                    <UButton
                      v-if="deploy?.logUrl || runsUrl"
                      :label="t('pluto.github.deploy.pages.runs')"
                      :to="deploy?.logUrl || runsUrl"
                      color="neutral"
                      size="sm"
                      target="_blank"
                      trailing-icon="i-lucide-arrow-up-right"
                      variant="ghost"
                    />
                  </div>
                </div>
              </li>
            </ol>

            <div
              v-if="showWorkflow || !status.local"
              class="flex flex-col gap-y-2"
            >
              <div class="flex items-center justify-between gap-2">
                <code class="text-muted text-xs">
                  {{ status.workflow.path }}
                </code>
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
          </template>

          <UAlert
            v-if="removed && status?.local"
            :title="t('pluto.github.deploy.remove.done.title')"
            :description="t('pluto.github.deploy.remove.done.description')"
            :actions="[
              ...(localGit.ahead.value
                ? [
                    {
                      label: t('pluto.github.local.push'),
                      icon: 'i-lucide-upload',
                      loading: localGit.pushing.value,
                      onClick: push,
                    },
                  ]
                : []),
              {
                label: t('pluto.github.deploy.pages.settings'),
                to: pagesSettingsUrl,
                target: '_blank',
                color: 'neutral',
                variant: 'outline',
                trailingIcon: 'i-lucide-arrow-up-right',
              },
            ]"
            color="info"
            icon="i-lucide-info"
            variant="subtle"
          />
          <UAlert
            v-if="removeError"
            :description="removeError"
            color="error"
            icon="i-lucide-circle-x"
            variant="subtle"
          />

          <div class="flex flex-wrap items-center justify-between gap-3">
            <p class="text-muted text-xs">
              {{ t('pluto.github.deploy.pages.nodeAdmin') }}
            </p>
            <UButton
              v-if="status?.local && status.workflow.exists"
              :label="t('pluto.github.deploy.remove.action')"
              :loading="removing"
              color="error"
              icon="i-lucide-trash-2"
              size="sm"
              variant="ghost"
              @click="removeOpen = true"
            />
          </div>
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
              <UTooltip :text="t('pluto.common.copy')">
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
              </UTooltip>
            </dd>
            <dt class="text-muted text-sm">
              {{ t('pluto.github.deploy.cloudflare.output') }}
            </dt>
            <dd class="flex items-center gap-2">
              <code class="text-sm">{{ cloudflare.output }}</code>
              <UTooltip :text="t('pluto.common.copy')">
                <UButton
                  :aria-label="t('pluto.common.copy')"
                  :icon="
                    copied === 'output' ? 'i-lucide-check' : 'i-lucide-copy'
                  "
                  color="neutral"
                  size="xs"
                  variant="ghost"
                  @click="copy('output', cloudflare.output)"
                />
              </UTooltip>
            </dd>
          </dl>
          <UButton
            :label="t('pluto.github.deploy.cloudflare.action')"
            :to="cloudflare.url"
            class="self-start"
            color="neutral"
            target="_blank"
            trailing-icon="i-lucide-arrow-up-right"
            variant="outline"
          />
        </div>
      </UCard>
    </section>

    <PlutoGithubDeployDomain
      v-if="status"
      :status="status"
      :pages-settings-url="pagesSettingsUrl"
      :runs-url="runsUrl"
    />

    <UModal
      v-if="status"
      v-model:open="confirmOpen"
      :title="t('pluto.github.deploy.confirm.title')"
      :description="t('pluto.github.deploy.confirm.description')"
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
          <li>{{ t('pluto.github.deploy.confirm.github') }}</li>
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
            icon="i-lucide-file-plus"
            @click="setupPages"
          />
        </div>
      </template>
    </UModal>

    <UModal
      v-if="status"
      v-model:open="removeOpen"
      :title="t('pluto.github.deploy.remove.title')"
      :description="t('pluto.github.deploy.remove.description')"
    >
      <template #body>
        <ul class="flex list-disc flex-col gap-y-1 pl-5 text-sm">
          <li>
            {{
              t('pluto.github.deploy.remove.delete', {
                path: status.workflow.path,
              })
            }}
          </li>
          <li>{{ t('pluto.github.deploy.remove.push') }}</li>
          <li>{{ t('pluto.github.deploy.remove.unpublish') }}</li>
        </ul>
      </template>
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton
            :label="t('pluto.common.cancel')"
            color="neutral"
            variant="ghost"
            @click="removeOpen = false"
          />
          <UButton
            :label="t('pluto.github.deploy.remove.confirm')"
            color="error"
            icon="i-lucide-trash-2"
            @click="removePages"
          />
        </div>
      </template>
    </UModal>
  </div>
</template>

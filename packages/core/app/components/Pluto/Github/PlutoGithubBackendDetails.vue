<script setup lang="ts">
import { usePlutoGithubLocalGit } from '../../../../modules/pluto-github/runtime/app/composables/pluto-github-local-git'
import { usePlutoGithubSession } from '../../../../modules/pluto-github/runtime/app/composables/pluto-github-session'

const { t } = usePlutoI18n()
const errorText = usePlutoErrorText()
const config = useRuntimeConfig().public.plutoGithub as
  | {
      storage?: string
      repo?: string
      branch?: string
    }
  | undefined
const local = config?.storage === 'fs'
const repo = config?.repo || ''
const branch = config?.branch || 'main'
const session = usePlutoGithubSession()
const git = usePlutoGithubLocalGit()
const pushError = ref('')
const pushed = ref(false)

const repoUrl = computed(() => (repo ? `https://github.com/${repo}` : ''))
const commitsUrl = computed(() =>
  repo ? `https://github.com/${repo}/commits/${encodeURIComponent(branch)}` : ''
)
const visibility = computed(() => {
  const value = session.repo.value?.private
  if (value === undefined) {
    return ''
  }
  return value
    ? t('pluto.github.backend.private')
    : t('pluto.github.backend.public')
})

const localState = computed(() => {
  const status = git.status.value
  if (!status) {
    return null
  }
  if (!status.repo) {
    return status.reason === 'no-git'
      ? t('pluto.github.local.noGit')
      : t('pluto.github.local.notARepo')
  }
  if (!status.branch) {
    return t('pluto.github.local.detached')
  }
  if (!status.remote) {
    return t('pluto.github.local.noRemote')
  }
  return status.ahead
    ? t('pluto.github.local.ahead', status.ahead)
    : t('pluto.github.local.upToDate')
})
const canPush = computed(() => {
  const status = git.status.value
  return Boolean(
    status?.repo && status.branch && status.remote && status.ahead > 0
  )
})

async function push() {
  pushError.value = ''
  pushed.value = false
  try {
    await git.push()
    pushed.value = true
  } catch (error) {
    pushError.value = errorText(error, 'pluto.github.local.errors.failed')
  }
}
</script>

<template>
  <div class="space-y-3">
    <template v-if="local">
      <p class="text-muted">{{ t('pluto.github.local.description') }}</p>

      <dl class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
        <template v-if="git.status.value?.repo && git.status.value.branch">
          <dt class="text-muted">{{ t('pluto.github.backend.branch') }}</dt>
          <dd class="text-highlighted truncate font-mono text-xs/5">
            {{ git.status.value.branch }}
          </dd>
        </template>
        <template v-if="repo">
          <dt class="text-muted">{{ t('pluto.github.backend.repo') }}</dt>
          <dd class="truncate">
            <PlutoExternalLink :to="repoUrl" class="font-mono text-xs/5">
              {{ repo }}
            </PlutoExternalLink>
          </dd>
        </template>
      </dl>

      <div
        class="border-default flex items-center justify-between gap-3 rounded-md border px-3 py-2"
      >
        <p v-if="localState" class="text-highlighted min-w-0">
          {{ localState }}
        </p>
        <USkeleton v-else class="h-4 w-32" />
        <UButton
          v-if="canPush"
          :label="t('pluto.github.local.push')"
          :loading="git.pushing.value"
          icon="i-lucide-upload"
          size="xs"
          @click="push"
        />
      </div>

      <p
        v-if="pushed && !canPush"
        class="text-success flex items-center gap-1.5"
        role="status"
      >
        <UIcon name="i-lucide-check" class="size-4" />
        {{ t('pluto.github.local.pushed') }}
      </p>
      <p v-if="pushError" class="text-error" role="alert">
        {{ pushError }}
      </p>
      <p v-else-if="canPush" class="text-muted text-xs">
        {{ t('pluto.github.local.pushHint') }}
      </p>
    </template>

    <template v-else>
      <p class="text-muted">
        {{ t('pluto.github.backend.description') }}
      </p>
      <dl class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
        <dt class="text-muted">{{ t('pluto.github.backend.repo') }}</dt>
        <dd class="flex min-w-0 items-center gap-2">
          <span class="text-highlighted truncate font-mono text-xs/5">
            {{ repo }}
          </span>
          <UBadge
            v-if="visibility"
            :label="visibility"
            color="neutral"
            size="sm"
            variant="subtle"
          />
        </dd>
        <dt class="text-muted">{{ t('pluto.github.backend.branch') }}</dt>
        <dd class="text-highlighted truncate font-mono text-xs/5">
          {{ branch }}
        </dd>
      </dl>
      <div v-if="repoUrl" class="flex flex-wrap gap-2">
        <UButton
          :label="t('pluto.github.backend.openRepo')"
          :to="repoUrl"
          color="neutral"
          icon="i-pluto-github"
          size="xs"
          target="_blank"
          trailing-icon="i-lucide-arrow-up-right"
          variant="outline"
        />
        <UButton
          :label="t('pluto.github.backend.commits')"
          :to="commitsUrl"
          color="neutral"
          icon="i-lucide-history"
          size="xs"
          target="_blank"
          trailing-icon="i-lucide-arrow-up-right"
          variant="outline"
        />
      </div>
    </template>
  </div>
</template>

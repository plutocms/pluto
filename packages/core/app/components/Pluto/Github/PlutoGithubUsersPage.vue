<script setup lang="ts">
// The Users page of the Git CMS (`/admin/users`). The CMS module adds the
// route with `extendPages`, and the client plugin adds the Users item of the
// menu. It lists the people with write access to the content repo, read only:
// GitHub owns the access, so the page links to the access settings of the
// repo. See the git-cms skill.
import type { TableColumn } from '@nuxt/ui'
import type {
  PlutoGithubRepoUser,
  PlutoGithubUsersResponse,
} from '../../../../modules/pluto-github/runtime/shared/repo-users'

const { t } = usePlutoI18n()
const errorText = usePlutoErrorText()
const auth = usePlutoAuth()

useHead({ title: () => t('pluto.github.users.title') })

const answer = ref<PlutoGithubUsersResponse | null>(null)
const status = ref<'loading' | 'ready' | 'error'>('loading')
const loadError = ref('')

async function load() {
  status.value = 'loading'
  try {
    answer.value = await $fetch<PlutoGithubUsersResponse>(
      '/api/_pluto/github/users'
    )
    status.value = 'ready'
  } catch (error) {
    loadError.value = errorText(error)
    status.value = 'error'
  }
}
onMounted(load)

const repo = computed(
  () =>
    answer.value?.repo ||
    String(
      (useRuntimeConfig().public.plutoGithub as { repo?: string } | undefined)
        ?.repo ?? ''
    )
)
const accessUrl = computed(() =>
  repo.value ? `https://github.com/${repo.value}/settings/access` : ''
)
const self = computed(() => auth.user.value?.username?.toLowerCase() ?? '')
const users = computed(() => answer.value?.users ?? [])
// The i18n key of the reason why the list is empty.
const REASON_KEYS = {
  'no-app': 'noApp',
  'app-error': 'appError',
  'no-repo': 'noRepo',
} as const
const reasonKey = computed(() => REASON_KEYS[answer.value?.reason ?? 'no-repo'])

const columns = computed<TableColumn<PlutoGithubRepoUser>[]>(() => [
  { id: 'user', header: t('pluto.github.users.columns.user') },
  { id: 'role', header: t('pluto.github.users.columns.role') },
  { id: 'access', header: t('pluto.github.users.columns.access') },
])
</script>

<template>
  <main>
    <AdminView>
      <h1 class="text-3xl font-bold lg:text-4xl">
        {{ t('pluto.github.users.title') }}
      </h1>

      <div class="flex flex-wrap items-start justify-between gap-4">
        <p class="text-muted max-w-2xl text-sm">
          {{ t('pluto.github.users.description', { repo: repo || 'GitHub' }) }}
        </p>
        <UButton
          v-if="accessUrl"
          :label="t('pluto.github.users.manage')"
          :to="accessUrl"
          color="neutral"
          icon="i-pluto-github"
          target="_blank"
          trailing-icon="i-lucide-external-link"
          variant="outline"
        />
      </div>

      <UAlert
        v-if="answer?.restricted"
        :description="t('pluto.github.users.restricted')"
        color="info"
        icon="i-lucide-filter"
        variant="subtle"
      />

      <!-- Loading -->
      <div
        v-if="status === 'loading'"
        class="flex flex-col gap-y-3"
        aria-busy="true"
      >
        <USkeleton v-for="row in 3" :key="row" class="h-12 w-full" />
      </div>

      <!-- Error -->
      <UAlert
        v-else-if="status === 'error'"
        :title="t('pluto.github.users.error')"
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

      <!-- Local mode with no GitHub App or an App that cannot read, or no repo -->
      <UAlert
        v-else-if="answer?.reason"
        :title="t(`pluto.github.users.reason.${reasonKey}.title`)"
        :description="t(`pluto.github.users.reason.${reasonKey}.description`)"
        :actions="
          answer.reason !== 'no-repo'
            ? [
                {
                  label: t(`pluto.github.users.reason.${reasonKey}.action`),
                  to: '/admin/settings/github',
                  color: 'neutral',
                  variant: 'outline',
                },
              ]
            : []
        "
        color="neutral"
        icon="i-lucide-info"
        variant="subtle"
      />

      <UEmpty
        v-else-if="users.length === 0"
        :title="t('pluto.github.users.empty')"
        icon="i-lucide-users"
      />

      <UTable
        v-else
        :data="users"
        :columns="columns"
        class="border-default rounded-lg border"
      >
        <template #user-cell="{ row }">
          <div class="flex min-w-0 items-center gap-3">
            <UAvatar
              :src="row.original.avatarUrl || undefined"
              :alt="row.original.login"
              size="sm"
            />
            <ULink
              :to="row.original.url"
              class="text-highlighted truncate font-medium"
              target="_blank"
            >
              {{ row.original.login }}
            </ULink>
            <UBadge
              v-if="row.original.login.toLowerCase() === self"
              :label="t('pluto.github.users.you')"
              color="primary"
              size="sm"
              variant="subtle"
            />
          </div>
        </template>

        <template #role-cell="{ row }">
          <UBadge
            :label="t(`pluto.github.users.roles.${row.original.role}`)"
            :color="row.original.role === 'write' ? 'neutral' : 'primary'"
            variant="subtle"
          />
        </template>

        <template #access-cell="{ row }">
          <div class="flex flex-col items-start gap-1">
            <span class="text-sm">
              {{
                row.original.role === 'write'
                  ? t('pluto.github.users.access.editor')
                  : t('pluto.github.users.access.admin')
              }}
            </span>
            <UBadge
              v-if="!row.original.canSignIn"
              :label="t('pluto.github.users.blocked')"
              color="warning"
              size="sm"
              variant="subtle"
            />
          </div>
        </template>
      </UTable>

      <p class="text-muted text-xs">
        {{ t('pluto.github.users.footnote') }}
      </p>
    </AdminView>
  </main>
</template>

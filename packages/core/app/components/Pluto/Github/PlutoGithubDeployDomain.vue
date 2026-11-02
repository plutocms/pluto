<script setup lang="ts">
// The Domain section of the Deploy tab. A full-site host (Vercel, Netlify)
// serves the domain: the section links to its domain settings. For GitHub
// Pages, in local mode, the section sets the custom domain with the GitHub CLI
// (the Pages API). GitHub ignores a `CNAME` file when an Action builds the
// site, so Pluto writes none. See the git-cms skill.
import type {
  PlutoDeployStatus,
  PlutoPagesDomainResult,
} from '../../../../modules/pluto-github/runtime/shared/deploy'
import {
  GITHUB_PAGES_A,
  GITHUB_PAGES_AAAA,
  hostDomainSettingsUrl,
  isApexDomain,
} from '../../../../modules/pluto-github/runtime/shared/domain'

const props = defineProps<{ status: PlutoDeployStatus }>()
const emit = defineEmits<{ status: [status: PlutoDeployStatus] }>()

const { t } = usePlutoI18n()
const errorText = usePlutoErrorText()

const HOST_NAMES = { vercel: 'Vercel', netlify: 'Netlify' } as const

const detected = computed(() => props.status.host.id)
const otherHosts = computed(() =>
  (['vercel', 'netlify', 'cloudflare'] as const).map((id) => ({
    id,
    to: hostDomainSettingsUrl(id),
  }))
)

// --- GitHub Pages ------------------------------------------------------------

const pages = computed(() => props.status.pages)
const pagesOn = computed(() => pages.value?.state === 'on')
const cname = computed(() => pages.value?.cname ?? '')
const pagesSettingsUrl = computed(() =>
  props.status.repo
    ? `https://github.com/${props.status.repo}/settings/pages`
    : ''
)

const domainInput = ref(cname.value)
watch(cname, (value) => {
  domainInput.value = value
})

const saving = ref(false)
const error = ref('')
const notice = ref('')

async function send(body: { domain?: string; httpsEnforced?: boolean }) {
  saving.value = true
  error.value = ''
  notice.value = ''
  try {
    const result = await $fetch<PlutoPagesDomainResult>(
      '/api/_pluto/github/deploy/domain',
      { method: 'POST', body }
    )
    emit('status', result.status)
    if (body.domain !== undefined) {
      notice.value = result.rebuilt
        ? t('pluto.github.deploy.domain.pages.rebuilt')
        : t('pluto.github.deploy.domain.pages.push')
    }
  } catch (caught) {
    error.value = errorText(caught)
  } finally {
    saving.value = false
  }
}

const removeOpen = ref(false)
async function removeDomain() {
  removeOpen.value = false
  await send({ domain: '' })
}

// --- DNS and HTTPS -----------------------------------------------------------

const apex = ref(isApexDomain(cname.value))
watch(cname, (value) => {
  apex.value = isApexDomain(value)
})

const records = computed(() => {
  if (apex.value) {
    return [
      ...GITHUB_PAGES_A.map((value) => ({ type: 'A', name: '@', value })),
      ...GITHUB_PAGES_AAAA.map((value) => ({ type: 'AAAA', name: '@', value })),
    ]
  }
  const owner = props.status.repo.split('/')[0]?.toLowerCase() ?? ''
  const name = cname.value.split('.').slice(0, -2).join('.') || cname.value
  return [{ type: 'CNAME', name, value: `${owner}.github.io` }]
})

const certificateReady = computed(() =>
  ['issued', 'uploaded', 'approved'].includes(pages.value?.certificate ?? '')
)
</script>

<template>
  <section class="flex flex-col gap-y-3">
    <div>
      <h3 class="font-semibold">{{ t('pluto.github.deploy.domain.title') }}</h3>
      <p class="text-muted text-sm">
        {{ t('pluto.github.deploy.domain.description') }}
      </p>
    </div>

    <!-- A full-site host serves the domain. -->
    <UCard>
      <div class="flex flex-col gap-y-3">
        <div>
          <span class="font-semibold">
            {{ t('pluto.github.deploy.domain.hosts.title') }}
          </span>
          <p class="text-muted text-sm">
            {{ t('pluto.github.deploy.domain.hosts.description') }}
          </p>
        </div>
        <template v-if="detected">
          <p class="text-sm">
            {{
              t('pluto.github.deploy.domain.hosts.current', {
                host: HOST_NAMES[detected],
                domain: status.siteHost || status.host.site,
              })
            }}
          </p>
          <UButton
            :label="t('pluto.github.deploy.domain.hosts.open')"
            :to="hostDomainSettingsUrl(detected, status.host.site)"
            class="self-start"
            target="_blank"
            trailing-icon="i-lucide-external-link"
          />
        </template>
        <div v-else class="flex flex-wrap gap-2">
          <UButton
            v-for="host in otherHosts"
            :key="host.id"
            :label="t(`pluto.github.deploy.domain.hosts.${host.id}`)"
            :to="host.to"
            color="neutral"
            target="_blank"
            trailing-icon="i-lucide-external-link"
            variant="outline"
          />
        </div>
      </div>
    </UCard>

    <!-- GitHub Pages: the custom domain of the repo. -->
    <UCard>
      <div class="flex flex-col gap-y-4">
        <div>
          <div class="flex items-center gap-2">
            <UIcon name="i-pluto-github" class="size-5" />
            <span class="font-semibold">
              {{ t('pluto.github.deploy.domain.pages.name') }}
            </span>
          </div>
          <p class="text-muted text-sm">
            {{ t('pluto.github.deploy.domain.pages.description') }}
          </p>
        </div>

        <template v-if="status.local && pagesOn">
          <form
            class="flex flex-wrap items-end gap-2"
            @submit.prevent="send({ domain: domainInput })"
          >
            <UFormField
              :label="t('pluto.github.deploy.domain.pages.label')"
              class="min-w-0 grow sm:max-w-sm"
            >
              <UInput
                v-model="domainInput"
                :placeholder="t('pluto.github.deploy.domain.pages.placeholder')"
                autocapitalize="off"
                autocomplete="off"
                class="w-full"
                spellcheck="false"
              />
            </UFormField>
            <UButton
              :label="t('pluto.github.deploy.domain.pages.save')"
              :loading="saving"
              :disabled="!domainInput.trim() || domainInput.trim() === cname"
              type="submit"
            />
            <UButton
              v-if="cname"
              :label="t('pluto.github.deploy.domain.pages.remove')"
              :disabled="saving"
              color="error"
              variant="ghost"
              @click="removeOpen = true"
            />
          </form>

          <UAlert
            v-if="error"
            :description="error"
            color="error"
            icon="i-lucide-circle-x"
            variant="subtle"
          />
          <UAlert
            v-else-if="notice"
            :description="notice"
            color="success"
            icon="i-lucide-circle-check"
            variant="subtle"
          />

          <template v-if="cname">
            <div class="flex flex-col gap-y-2">
              <span class="text-sm font-medium">
                {{ t('pluto.github.deploy.domain.pages.dns.title') }}
              </span>
              <div class="flex flex-wrap gap-1">
                <UButton
                  :label="t('pluto.github.deploy.domain.pages.dns.subdomain')"
                  :variant="apex ? 'ghost' : 'soft'"
                  color="neutral"
                  size="xs"
                  @click="apex = false"
                />
                <UButton
                  :label="t('pluto.github.deploy.domain.pages.dns.apex')"
                  :variant="apex ? 'soft' : 'ghost'"
                  color="neutral"
                  size="xs"
                  @click="apex = true"
                />
              </div>
              <div class="overflow-x-auto">
                <table class="text-sm">
                  <thead class="text-muted text-left">
                    <tr>
                      <th class="pr-6 font-normal">
                        {{ t('pluto.github.deploy.domain.pages.dns.type') }}
                      </th>
                      <th class="pr-6 font-normal">
                        {{ t('pluto.github.deploy.domain.pages.dns.name') }}
                      </th>
                      <th class="font-normal">
                        {{ t('pluto.github.deploy.domain.pages.dns.value') }}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      v-for="record in records"
                      :key="`${record.type}-${record.value}`"
                    >
                      <td class="pr-6">
                        <code>{{ record.type }}</code>
                      </td>
                      <td class="pr-6">
                        <code>{{ record.name }}</code>
                      </td>
                      <td>
                        <code>{{ record.value }}</code>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div
              v-if="certificateReady"
              class="flex flex-wrap items-center justify-between gap-3"
            >
              <span class="flex items-center gap-2 text-sm">
                <UIcon name="i-lucide-lock" class="text-success size-4" />
                {{
                  t('pluto.github.deploy.domain.pages.https.issued', {
                    domain: cname,
                  })
                }}
              </span>
              <USwitch
                :model-value="Boolean(pages?.httpsEnforced)"
                :label="t('pluto.github.deploy.domain.pages.https.enforce')"
                :disabled="saving"
                @update:model-value="send({ httpsEnforced: $event })"
              />
            </div>
            <p v-else class="text-muted flex items-start gap-2 text-sm">
              <UIcon name="i-lucide-clock" class="mt-0.5 size-4 shrink-0" />
              {{ t('pluto.github.deploy.domain.pages.https.pending') }}
            </p>
          </template>
        </template>

        <p v-else-if="status.local" class="text-muted text-sm">
          {{ t('pluto.github.deploy.domain.pages.notReady') }}
        </p>

        <p v-else class="text-sm">
          {{ t('pluto.github.deploy.domain.pages.manual') }}
          <ULink
            v-if="pagesSettingsUrl"
            :to="pagesSettingsUrl"
            class="text-primary"
            target="_blank"
          >
            {{ t('pluto.github.deploy.pages.settings') }}
          </ULink>
        </p>
      </div>
    </UCard>

    <UModal
      v-model:open="removeOpen"
      :title="t('pluto.github.deploy.domain.pages.removeConfirm.title')"
      :description="
        t('pluto.github.deploy.domain.pages.removeConfirm.description')
      "
    >
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton
            :label="t('pluto.common.cancel')"
            color="neutral"
            variant="ghost"
            @click="removeOpen = false"
          />
          <UButton
            :label="t('pluto.github.deploy.domain.pages.remove')"
            color="error"
            @click="removeDomain"
          />
        </div>
      </template>
    </UModal>
  </section>
</template>

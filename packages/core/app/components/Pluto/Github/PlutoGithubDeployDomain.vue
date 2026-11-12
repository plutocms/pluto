<script setup lang="ts">
// The Domain section of the Deploy tab. A full-site host (Vercel, Netlify)
// serves the domain: the section links to its domain settings. For GitHub
// Pages, the domain lives in the Pages settings of the repo (GitHub ignores a
// `CNAME` file when an Action builds the site). The section links there, shows
// the DNS records, checks the DNS from the server, and links to the workflow to
// build the site again. It needs no CLI. See the git-cms skill.
import type {
  PlutoDeployStatus,
  PlutoDomainCheck,
} from '../../../../modules/pluto-github/runtime/shared/deploy'
import {
  GITHUB_PAGES_A,
  GITHUB_PAGES_AAAA,
  hostDomainSettingsUrl,
  isApexDomain,
  normalizeDomain,
} from '../../../../modules/pluto-github/runtime/shared/domain'

const props = defineProps<{
  status: PlutoDeployStatus
  pagesSettingsUrl: string
  runsUrl: string
}>()

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

/** The custom domain of the live Pages site, from the address of its last deploy. */
const currentDomain = computed(() => {
  const url = props.status.deploy.url
  if (!url) {
    return ''
  }
  try {
    const host = new URL(url).hostname
    return host.endsWith('.github.io') ? '' : host
  } catch {
    return ''
  }
})

/**
 * The address of a project site, which GitHub serves under `/<repo>/`. A custom domain, or a repo
 * named `<owner>.github.io`, serves the site at the root: the workflow then builds it for the root.
 */
const subpathUrl = computed(() => {
  const url = props.status.deploy.url
  if (!url || currentDomain.value) {
    return ''
  }
  try {
    return new URL(url).pathname.replace(/\/+$/, '') ? url : ''
  } catch {
    return ''
  }
})

const userSiteRepo = computed(
  () => `${props.status.repo.split('/')[0]?.toLowerCase() ?? ''}.github.io`
)

const domainInput = ref(currentDomain.value)
watch(currentDomain, (value) => {
  if (value && !domainInput.value) {
    domainInput.value = value
  }
})
const domain = computed(() => normalizeDomain(domainInput.value) ?? '')
const invalid = computed(
  () => Boolean(domainInput.value.trim()) && !normalizeDomain(domainInput.value)
)

const apex = ref(false)
watch(
  domain,
  (value) => {
    apex.value = isApexDomain(value)
  },
  { immediate: true }
)

const records = computed(() => {
  if (apex.value) {
    return [
      ...GITHUB_PAGES_A.map((value) => ({ type: 'A', name: '@', value })),
      ...GITHUB_PAGES_AAAA.map((value) => ({ type: 'AAAA', name: '@', value })),
    ]
  }
  const owner = props.status.repo.split('/')[0]?.toLowerCase() ?? ''
  const name = domain.value.split('.').slice(0, -2).join('.') || domain.value
  return [{ type: 'CNAME', name, value: `${owner}.github.io` }]
})

const checking = ref(false)
const check = ref<PlutoDomainCheck | null>(null)
const checkError = ref('')
watch(domain, () => {
  check.value = null
  checkError.value = ''
})

async function checkDns() {
  checking.value = true
  checkError.value = ''
  try {
    check.value = await $fetch<PlutoDomainCheck>(
      '/api/_pluto/github/deploy/dns',
      { query: { domain: domain.value } }
    )
  } catch (error) {
    checkError.value = errorText(error)
  } finally {
    checking.value = false
  }
}

const CHECK_ICONS = {
  ok: ['i-lucide-circle-check', 'text-success'],
  missing: ['i-lucide-circle-dashed', 'text-muted'],
  other: ['i-lucide-triangle-alert', 'text-warning'],
} as const
</script>

<template>
  <section class="flex flex-col gap-y-3">
    <div>
      <h2 class="font-semibold">{{ t('pluto.github.deploy.domain.title') }}</h2>
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
            trailing-icon="i-lucide-arrow-up-right"
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
            trailing-icon="i-lucide-arrow-up-right"
            variant="outline"
          />
        </div>
      </div>
    </UCard>

    <!-- GitHub Pages: the steps, with the DNS records and a DNS check. -->
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
          <p v-if="currentDomain" class="mt-1 text-sm">
            {{
              t('pluto.github.deploy.domain.pages.current', {
                domain: currentDomain,
              })
            }}
          </p>
          <p v-else-if="subpathUrl" class="mt-1 text-sm">
            {{
              t('pluto.github.deploy.domain.pages.subpath', {
                url: subpathUrl,
                repo: userSiteRepo,
              })
            }}
          </p>
        </div>

        <UFormField
          :label="t('pluto.github.deploy.domain.pages.label')"
          :error="
            invalid ? t('pluto.github.deploy.domain.errors.invalid') : false
          "
          class="sm:max-w-sm"
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

        <ol class="flex list-decimal flex-col gap-y-4 pl-5 text-sm">
          <li>
            <div class="flex flex-col items-start gap-2">
              <span>{{
                t('pluto.github.deploy.domain.pages.steps.settings')
              }}</span>
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

          <li>
            <div class="flex flex-col items-start gap-2">
              <span>{{ t('pluto.github.deploy.domain.pages.dns.title') }}</span>
              <p v-if="!domain" class="text-muted">
                {{ t('pluto.github.deploy.domain.pages.dns.typeFirst') }}
              </p>
              <template v-else>
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
                <div class="max-w-full overflow-x-auto">
                  <table>
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
                <UButton
                  :label="t('pluto.github.deploy.domain.pages.dns.check')"
                  :loading="checking"
                  color="neutral"
                  icon="i-lucide-search-check"
                  size="sm"
                  variant="outline"
                  @click="checkDns"
                />
                <p
                  v-if="check"
                  :class="check.state === 'ok' ? '' : 'text-muted'"
                  class="flex items-start gap-2"
                >
                  <UIcon
                    :name="CHECK_ICONS[check.state][0]"
                    :class="CHECK_ICONS[check.state][1]"
                    class="mt-0.5 size-4 shrink-0"
                  />
                  <span>
                    {{
                      t(`pluto.github.deploy.domain.pages.dns.${check.state}`, {
                        domain: check.domain,
                        found: check.found.join(', '),
                      })
                    }}
                  </span>
                </p>
                <p v-else-if="checkError" class="text-error">
                  {{ checkError }}
                </p>
              </template>
            </div>
          </li>

          <li>
            <div class="flex flex-col items-start gap-2">
              <span>{{
                t('pluto.github.deploy.domain.pages.steps.build')
              }}</span>
              <UButton
                :label="t('pluto.github.deploy.domain.pages.openWorkflow')"
                :to="runsUrl"
                :disabled="!runsUrl"
                color="neutral"
                size="sm"
                target="_blank"
                trailing-icon="i-lucide-arrow-up-right"
                variant="outline"
              />
            </div>
          </li>

          <li>{{ t('pluto.github.deploy.domain.pages.steps.https') }}</li>
        </ol>

        <p class="text-muted text-xs">
          {{ t('pluto.github.deploy.domain.pages.remove') }}
        </p>
      </div>
    </UCard>
  </section>
</template>

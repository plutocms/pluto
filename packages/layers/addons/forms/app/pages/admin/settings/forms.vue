<script setup lang="ts">
interface FormsStatus {
  store: {
    ok: boolean
    source: 'registered' | 'storage' | 'dev-fs' | 'none' | 'missing-mount'
    mount: string | null
    dev: boolean
  }
  secret: {
    ok: boolean
    source: 'env' | 'github' | 'dev' | 'none'
  }
  turnstile: {
    on: boolean
    half: boolean
  }
  mail: {
    driver: string
    configured: boolean
    logOnly: boolean
  }
}

type Host = 'vercel' | 'netlify' | 'cloudflare' | 'server'

const HOSTS: Host[] = ['vercel', 'netlify', 'cloudflare', 'server']

const SNIPPETS: Record<Host, string> = {
  vercel: `export default defineNuxtConfig({
  nitro: {
    storage: {
      forms: { driver: 'upstash' },
    },
  },
  plutoForms: { storage: 'forms' },
})`,
  netlify: `export default defineNuxtConfig({
  nitro: {
    storage: {
      forms: { driver: 'netlify-blobs', name: 'pluto-forms' },
    },
  },
  plutoForms: { storage: 'forms' },
})`,
  cloudflare: `export default defineNuxtConfig({
  nitro: {
    storage: {
      forms: { driver: 'cloudflare-kv-binding', binding: 'FORMS' },
    },
  },
  plutoForms: { storage: 'forms' },
})`,
  server: `export default defineNuxtConfig({
  nitro: {
    storage: {
      forms: { driver: 'fs', base: './data/forms' },
    },
  },
  plutoForms: { storage: 'forms' },
})`,
}

const { t, tx } = usePlutoI18n()

useHead({
  title: () => `${t('forms.settings.title')} - ${t('pluto.pages.settings')}`,
})

const host = ref<Host>('vercel')

const { data: status, status: loading } = useFetch<FormsStatus>(
  '/api/_pluto/forms/status',
  {
    key: 'pluto-forms-status',
    server: false,
    lazy: true,
  }
)

const storeState = computed(() => {
  const source = status.value?.store.source
  if (source === 'registered' || source === 'storage') {
    return 'ok'
  }
  return source === 'dev-fs' ? 'dev' : 'missing'
})
</script>

<template>
  <div class="flex flex-col gap-y-6 lg:gap-y-8">
    <p class="text-muted text-sm">
      {{ t('forms.settings.intro') }}
    </p>

    <p v-if="loading === 'pending' && !status" class="text-muted text-sm">
      {{ t('forms.admin.loading') }}
    </p>

    <template v-if="status">
      <UCard>
        <template #header>
          <div class="flex items-center justify-between gap-x-2">
            <h2 class="font-semibold">
              {{ t('forms.settings.store.title') }}
            </h2>

            <UBadge
              :color="storeState === 'ok' ? 'success' : storeState === 'dev' ? 'warning' : 'error'"
              :label="tx(`forms.settings.store.state.${storeState}`)"
              variant="subtle"
            />
          </div>
        </template>

        <div class="flex flex-col gap-y-4 text-sm">
          <p>{{ t('forms.settings.store.why') }}</p>

          <p v-if="status.store.source === 'storage' || status.store.source === 'dev-fs'">
            {{ t('forms.settings.store.mount', { name: status.store.mount ?? '' }) }}
          </p>

          <p v-if="status.store.source === 'missing-mount'">
            {{ t('forms.settings.store.missingMount', { name: status.store.mount ?? '' }) }}
          </p>

          <p v-if="storeState === 'dev'">
            {{ t('forms.settings.store.devHint') }}
          </p>

          <div v-if="storeState !== 'ok'" class="flex flex-col gap-y-3">
            <h3 class="font-medium">
              {{ t('forms.settings.store.pick') }}
            </h3>

            <div class="flex flex-wrap gap-2">
              <UButton
                v-for="option in HOSTS"
                :key="option"
                :label="tx(`forms.settings.hosts.${option}.name`)"
                :color="host === option ? 'primary' : 'neutral'"
                :variant="host === option ? 'solid' : 'outline'"
                size="sm"
                @click="host = option"
              />
            </div>

            <ol class="flex list-decimal flex-col gap-y-2 ps-5">
              <li>{{ tx(`forms.settings.hosts.${host}.step1`) }}</li>

              <li>{{ tx(`forms.settings.hosts.${host}.step2`) }}</li>

              <li>{{ t('forms.settings.store.stepConfig') }}</li>

              <li>{{ t('forms.settings.store.stepDeploy') }}</li>
            </ol>

            <pre class="bg-elevated overflow-x-auto rounded-md p-3 text-xs">{{ SNIPPETS[host] }}</pre>
          </div>
        </div>
      </UCard>

      <UCard>
        <template #header>
          <div class="flex items-center justify-between gap-x-2">
            <h2 class="font-semibold">
              {{ t('forms.settings.secret.title') }}
            </h2>

            <UBadge
              :color="status.secret.ok ? 'success' : 'warning'"
              :label="status.secret.ok ? t('forms.settings.on') : t('forms.settings.needsSetup')"
              variant="subtle"
            />
          </div>
        </template>

        <div class="flex flex-col gap-y-2 text-sm">
          <p>{{ t('forms.settings.secret.why') }}</p>

          <p v-if="status.secret.source === 'github'">
            {{ t('forms.settings.secret.fromGithub') }}
          </p>

          <p v-else-if="!status.secret.ok">
            {{ t('forms.settings.secret.set') }}
          </p>
        </div>
      </UCard>

      <UCard>
        <template #header>
          <div class="flex items-center justify-between gap-x-2">
            <h2 class="font-semibold">
              {{ t('forms.settings.turnstile.title') }}
            </h2>

            <UBadge
              :color="status.turnstile.on ? 'success' : 'neutral'"
              :label="status.turnstile.on ? t('forms.settings.on') : t('forms.settings.optional')"
              variant="subtle"
            />
          </div>
        </template>

        <div class="flex flex-col gap-y-3 text-sm">
          <p>{{ t('forms.settings.turnstile.why') }}</p>

          <p v-if="status.turnstile.half" class="text-warning">
            {{ t('forms.settings.turnstile.half') }}
          </p>

          <ol v-if="!status.turnstile.on" class="flex list-decimal flex-col gap-y-2 ps-5">
            <li>{{ t('forms.settings.turnstile.step1') }}</li>

            <li>{{ t('forms.settings.turnstile.step2') }}</li>

            <li>{{ t('forms.settings.turnstile.step3') }}</li>
          </ol>

          <div>
            <UButton
              :label="t('forms.settings.turnstile.open')"
              to="https://dash.cloudflare.com/?to=/:account/turnstile"
              target="_blank"
              rel="noopener noreferrer"
              trailing-icon="i-lucide-arrow-up-right"
              color="neutral"
              variant="outline"
            />
          </div>
        </div>
      </UCard>

      <UCard>
        <template #header>
          <div class="flex items-center justify-between gap-x-2">
            <h2 class="font-semibold">
              {{ t('forms.settings.mail.title') }}
            </h2>

            <UBadge
              :color="status!.mail.configured && !status!.mail.logOnly ? 'success' : 'warning'"
              :label="status!.mail.configured && !status!.mail.logOnly ? t('forms.settings.on') : t('forms.settings.needsSetup')"
              variant="subtle"
            />
          </div>
        </template>

        <div class="flex flex-col gap-y-3 text-sm">
          <p>{{ t('forms.settings.mail.why') }}</p>

          <p v-if="status!.mail.logOnly">
            {{ t('forms.settings.mail.logOnly') }}
          </p>

          <p v-else-if="!status!.mail.configured">
            {{ t('forms.settings.mail.none') }}
          </p>

          <div>
            <UButton
              :label="t('forms.settings.mail.open')"
              to="/admin/settings/email"
              color="neutral"
              variant="outline"
            />
          </div>
        </div>
      </UCard>
    </template>
  </div>
</template>

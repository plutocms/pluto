<script setup lang="ts">
// The Email tab of Settings (admin only). A guided setup for the mail driver:
// status, a Resend account, the key, a first test, a domain, the From address,
// a test to anyone, and an optional sending-only key. The Resend key stays in
// the environment of the server. See the mail skill.
//
// The step components are lazy: Nuxt splits each one into its own chunk.
const { t } = usePlutoI18n()

useHead({
  title: () => `${t('pluto.mail.page.title')} - ${t('pluto.pages.settings')}`,
})

const { items: panels } = usePlutoMailPanels()
</script>

<template>
  <div class="flex flex-col gap-y-6 lg:gap-y-8">
    <div>
      <h2 class="text-xl font-semibold">
        {{ t('pluto.mail.page.title') }}
      </h2>
      <p class="text-muted text-sm">
        {{ t('pluto.mail.page.intro') }}
      </p>
    </div>

    <LazyPlutoMailStatusCard />

    <PlutoMailStep
      :number="1"
      :title="t('pluto.mail.account.title')"
      :description="t('pluto.mail.account.description')"
    >
      <p class="text-muted text-sm">
        {{ t('pluto.mail.account.body') }}
      </p>
      <div>
        <UButton
          to="https://resend.com/signup"
          target="_blank"
          rel="noopener noreferrer"
          icon="lucide:external-link"
          color="neutral"
          variant="outline"
        >
          {{ t('pluto.mail.account.link') }}
        </UButton>
      </div>
    </PlutoMailStep>

    <LazyPlutoMailStepKey />
    <LazyPlutoMailStepTest :number="3" mode="self" />
    <LazyPlutoMailStepDomain />
    <LazyPlutoMailStepFrom />
    <LazyPlutoMailStepTest :number="6" mode="anyone" />
    <LazyPlutoMailStepSendingKey />

    <!-- Sections that other layers add (the mailPanels bucket). -->
    <UCard v-for="panel in panels" :key="panel.id">
      <template #header>
        <h2 class="font-semibold">
          {{ panel.title }}
        </h2>
        <p v-if="panel.description" class="text-muted text-sm">
          {{ panel.description }}
        </p>
      </template>

      <Suspense>
        <component :is="panel.component" />

        <template #fallback>
          <PlutoSkeletonWidget variant="panel" height="8rem" />
        </template>
      </Suspense>
    </UCard>
  </div>
</template>

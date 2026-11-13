<script setup lang="ts">
const { t } = usePlutoI18n()

useHead({
  title: () => `${t('pluto.mail.page.title')} - ${t('pluto.pages.settings')}`,
})

const { items: panels } = usePlutoMailPanels()
</script>

<template>
  <div class="flex flex-col gap-y-6 lg:gap-y-8">
    <p class="text-muted text-sm">
      {{ t('pluto.mail.page.intro') }}
    </p>

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
          trailing-icon="i-lucide-arrow-up-right"
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

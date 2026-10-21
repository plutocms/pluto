<script setup lang="ts">
defineProps<{
  title?: string
  icon?: string
  /** Path for a back button, rendered before the title. */
  backTo?: string
}>()

defineSlots<{
  left?: () => unknown
  title?: () => unknown
  default?: () => unknown
  right?: () => unknown
  trailing?: () => unknown
}>()

const { t } = usePlutoI18n()
</script>

<template>
  <!--
    `:toggle="false"` is load-bearing. UDashboardNavbar's default toggle
    button calls Nuxt UI's global `dashboard:sidebar:toggle` hook, which
    controls the app-level LEFT sidebar from admin.vue. This is a SECOND,
    page-local navbar — its own toggle would open and close the wrong
    sidebar, so it must never render one.
  -->
  <UDashboardNavbar
    :title="title"
    :icon="icon"
    :toggle="false"
    :ui="{ root: 'h-12 border-muted' }"
  >
    <template v-if="$slots.left" #left>
      <slot name="left" />
    </template>

    <template v-if="backTo || icon" #leading>
      <UTooltip v-if="backTo" :text="t('pluto.common.back')">
        <UButton
          :to="backTo"
          :aria-label="t('pluto.common.back')"
          icon="i-lucide-arrow-left"
          color="neutral"
          variant="ghost"
          square
        />
      </UTooltip>
      <UIcon v-if="icon" :name="icon" class="me-1.5 size-5 shrink-0 self-center" />
    </template>

    <template v-if="$slots.title" #title>
      <slot name="title" />
    </template>

    <template v-if="$slots.default" #default>
      <slot />
    </template>

    <template v-if="$slots.right" #right>
      <slot name="right" />
    </template>

    <template v-if="$slots.trailing" #trailing>
      <slot name="trailing" />
    </template>
  </UDashboardNavbar>
</template>

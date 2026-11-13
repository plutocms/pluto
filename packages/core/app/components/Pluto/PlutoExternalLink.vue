<script setup lang="ts">
defineProps<{
  /**
   * The URL of the other site.
   * @see https://pluto.vulmix.dev/docs/extend/forms
   */
  to: string
}>()

const { t } = usePlutoI18n()
</script>

<template>
  <ULink :to="to" target="_blank" rel="noopener noreferrer" external>
    <slot />
    <UIcon
      name="i-lucide-arrow-up-right"
      class="ms-0.5 inline-block size-[0.85em] shrink-0 align-[-0.05em]"
      aria-hidden="true"
    />
    <span class="sr-only">({{ t('pluto.common.opensInNewTab') }})</span>
  </ULink>
</template>

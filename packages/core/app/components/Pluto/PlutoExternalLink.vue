<script setup lang="ts">
// A link to another site inside a sentence or a cell: it opens in a new tab and ends with the
// external icon of Nuxt UI (`i-lucide-arrow-up-right`, the icon its menus add to an item that
// opens in a new tab). A button to another site has it as its `trailing-icon`.
// Screen readers hear that the link opens a new tab.
defineProps<{
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

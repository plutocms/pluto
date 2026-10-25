<script setup lang="ts">
// Environment lines to copy, one row each. v1 keeps the mail secrets in the
// environment of the server only. The admin never stores them.
defineProps<{
  lines: string[]
}>()

const { t } = usePlutoI18n()
</script>

<template>
  <ul class="border-default bg-elevated/50 divide-default divide-y rounded-md border">
    <li v-for="line in lines" :key="line" class="flex items-center gap-2 px-3 py-2">
      <code class="min-w-0 flex-1 overflow-x-auto text-sm whitespace-nowrap">{{ line }}</code>
      <PlutoMailCopy :text="line" :label="t('pluto.mail.env.copyLine')" />
    </li>
  </ul>
</template>

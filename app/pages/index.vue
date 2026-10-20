<script setup lang="ts">
definePageMeta({
  layout: 'admin',
})

const { t } = usePlutoI18n()

useHead({ title: () => t('pluto.nav.home') })
</script>

<template>
  <div>Home</div>
</template>

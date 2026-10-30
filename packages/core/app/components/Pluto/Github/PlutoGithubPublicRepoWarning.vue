<script setup lang="ts">
// A dashboard widget. The CMS shows it when the content repo is public: a
// draft is a file in the repo, so anyone can read it on GitHub.
const { t } = usePlutoI18n()
</script>

<template>
  <UAlert
    :title="t('pluto.github.publicRepo.title')"
    :description="t('pluto.github.publicRepo.description')"
    color="warning"
    variant="subtle"
    icon="lucide:triangle-alert"
  />
</template>

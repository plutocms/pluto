<script setup lang="ts">
definePageMeta({
  layout: 'full',
})

const route = useRoute()

const { page } = await usePage(() =>
  Array.isArray(route.params.path)
    ? route.params.path.join('/')
    : String(route.params.path)
)

const full = computed(() => page.value?.layout === 'full')
</script>

<template>
  <PlutoBlocks v-if="page && full" :value="page.blocks" tag="div" />

  <UContainer v-else-if="page" as="article" class="max-w-3xl py-10">
    <h1 class="text-highlighted text-3xl font-semibold">
      {{ page.title }}
    </h1>

    <p v-if="page.description" class="text-muted mt-3 text-lg">
      {{ page.description }}
    </p>

    <div class="mt-8">
      <PlutoBlocks :value="page.blocks" />
    </div>
  </UContainer>
</template>

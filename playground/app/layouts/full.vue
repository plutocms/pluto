<script setup lang="ts">
const site = usePlutoSite()
</script>

<template>
  <div class="bg-default min-h-dvh">
    <header class="border-default border-b">
      <UContainer class="flex h-14 items-center justify-between gap-4">
        <NuxtLink to="/" class="text-highlighted font-semibold">
          {{ site.name }}
        </NuxtLink>
        <SiteNav />
      </UContainer>
    </header>

    <main>
      <slot />
    </main>

    <SiteFooter />
  </div>
</template>

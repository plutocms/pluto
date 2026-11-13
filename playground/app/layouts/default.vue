<script setup lang="ts">
const site = usePlutoSite()

const { item: contact } = usePlutoSingleton('contact')
</script>

<template>
  <div class="bg-default min-h-dvh">
    <header class="border-default border-b">
      <UContainer class="flex h-14 items-center justify-between gap-4">
        <NuxtLink to="/" class="text-highlighted font-semibold">
          {{ site.name }}
        </NuxtLink>
        <nav class="flex items-center gap-4 text-sm">
          <NuxtLink to="/" class="text-muted hover:text-highlighted">
            Posts
          </NuxtLink>
          <NuxtLink to="/admin" class="text-muted hover:text-highlighted">
            Admin
          </NuxtLink>
        </nav>
      </UContainer>
    </header>

    <UContainer as="main" class="max-w-3xl py-10">
      <slot />
    </UContainer>

    <footer class="border-default text-muted border-t text-sm">
      <UContainer class="flex max-w-3xl flex-wrap gap-x-6 gap-y-1 py-6">
        <template v-if="contact">
          <a :href="`mailto:${contact.email}`" class="hover:text-highlighted">
            {{ contact.email }}
          </a>

          <span v-if="contact.phone">{{ contact.phone }}</span>

          <span v-if="contact.address">{{ contact.address }}</span>
        </template>

        <span v-else>No contact info yet.</span>
      </UContainer>
    </footer>
  </div>
</template>

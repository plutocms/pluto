<script setup lang="ts">
const { area } = usePlutoArea('footer')

const { item: contact } = usePlutoSingleton('contact', {
  editLink: false,
})
</script>

<template>
  <footer class="border-default text-muted border-t text-sm">
    <PlutoBlocks v-if="area" :value="area.blocks" tag="div" />

    <UContainer v-else class="flex max-w-3xl flex-wrap gap-x-6 gap-y-1 py-6">
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
</template>

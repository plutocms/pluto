<script setup lang="ts">
useHead({
  title: 'Settings',
})

const { items } = usePlutoSettingsPanels()
const { hasDriver, status, load, save } = usePlutoSettings()

onMounted(() => {
  if (hasDriver.value) {
    load()
  }
})
</script>

<template>
  <main>
    <AdminView>
      <h1 class="text-3xl font-bold lg:text-4xl">Settings</h1>

      <UAlert
        v-if="!hasDriver"
        color="warning"
        title="No settings storage"
        description="No installed layer provides settings storage yet."
      />

      <template v-else>
        <UCard v-for="panel in items" :key="panel.id">
          <template #header>
            <h2 class="font-semibold">{{ panel.title }}</h2>
            <p v-if="panel.description" class="text-muted text-sm">{{ panel.description }}</p>
          </template>

          <component :is="panel.component" />
        </UCard>

        <div class="flex">
          <UButton :loading="status === 'saving'" icon="lucide:save" @click="save">
            Save
          </UButton>
        </div>
      </template>
    </AdminView>
  </main>
</template>

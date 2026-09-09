<script setup lang="ts">
useHead({
  title: `Admin`,
})
</script>

<template>
  <main>
    <AdminView>
      <h1 class="text-3xl font-bold lg:text-4xl">Admin Dashboard</h1>

      <div class="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:gap-x-4 lg:gap-y-6">
        <div
          v-for="i in 6"
          :key="i"
          class="h-50 rounded-3xl border border-gray-500"
        />
      </div>
    </AdminView>
  </main>
</template>

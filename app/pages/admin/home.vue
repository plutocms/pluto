<script setup lang="ts">
useHead({
  title: `Admin`,
})
</script>

<template>
  <main>
    <AdminView>
      <h1 class="text-4xl font-bold">Admin Dashboard</h1>

      <div class="grid grid-cols-3 gap-x-4 gap-y-6">
        <div
          v-for="i in 6"
          :key="i"
          class="h-50 rounded-3xl border border-gray-500"
        />
      </div>
    </AdminView>
  </main>
</template>

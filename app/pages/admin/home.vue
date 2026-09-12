<script setup lang="ts">
useHead({
  title: `Admin`,
})
</script>

<template>
  <main>
    <AdminView>
      <h1 class="text-3xl font-bold lg:text-4xl">Admin Dashboard</h1>

      <PlutoDashboardWidgets />
    </AdminView>
  </main>
</template>

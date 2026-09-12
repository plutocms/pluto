<script setup lang="ts">
const { items } = usePlutoNavbarActions()
</script>

<template>
  <component :is="item.component" v-for="item in items" :key="item.id" />
</template>

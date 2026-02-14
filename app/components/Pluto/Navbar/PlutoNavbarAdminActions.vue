<script setup lang="ts">
const { actions } = useNavbarAdminActions()
</script>

<template>
  <component :is="action" v-for="(action, i) in actions" :key="i" />
</template>

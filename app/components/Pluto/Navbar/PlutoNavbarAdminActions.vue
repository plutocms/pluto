<script setup lang="ts">
const { items } = usePlutoNavbarActions()
const { tx } = usePlutoI18n()

function target(to: string | (() => string)): string {
  return typeof to === 'function' ? to() : to
}
</script>

<template>
  <template v-for="item in items" :key="item.id">
    <PlutoNavbarButton
      v-if="'to' in item"
      :label="tx(item.label)"
      :icon="item.icon"
      :to="target(item.to)"
      :target="item.target"
    />
    <component :is="item.component" v-else />
  </template>
</template>

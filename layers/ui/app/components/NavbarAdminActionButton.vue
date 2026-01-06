<script setup lang="ts">
import type { NavbarAdminActionButtonProps } from '#layers/utils/shared/types/navbar'

type Props = NavbarAdminActionButtonProps

const props = defineProps<Props>()
</script>

<template>
  <li v-if="props.show" class="nav-item">
    <NuxtLink
      :to="props.to?.toString()"
      :title="props.title"
      :disabled="props.disabled"
      :target="props.target"
      class="nav-link"
    >
      <span class="nav-content">
        <Icon v-if="props.icon" :name="props.icon" />

        <span> {{ props.label }} </span>
      </span>
    </NuxtLink>
  </li>
</template>

<style scoped>
.nav-item {
  height: 100%;
  list-style: none;
}

.nav-link {
  display: block;
  height: 100%;
  background-color: transparent;
  padding-top: 0.25rem;
  padding-bottom: 0.25rem;
  transition-property: none;
}

.nav-content {
  box-sizing: content-box;
  display: flex;
  height: 100%;
  align-items: center;
  gap: 0.5rem;
  border-radius: 0.125rem;
  padding-left: 0.5rem;
  padding-right: 0.5rem;
}

.nav-link:hover .nav-content {
  background-color: rgba(0, 0, 0, 0.1);
}

.dark .nav-link:hover .nav-content {
  background-color: rgba(255, 255, 255, 0.2);
}
</style>

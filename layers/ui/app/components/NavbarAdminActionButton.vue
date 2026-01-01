<script setup lang="ts">
import type { NavbarAdminActionButtonProps } from '#layers/utils/shared/types/navbar'

type Props = NavbarAdminActionButtonProps

const props = defineProps<Props>()
</script>

<template>
  <li v-if="props.show" class="h-full">
    <NuxtLink
      :to="props.to?.toString()"
      :title="props.title"
      :disabled="props.disabled"
      :target="props.target"
      class="group block h-full bg-transparent py-1 transition-none"
    >
      <span
        class="light:group-hover:bg-black/10 box-content flex h-full items-center gap-x-2 rounded-sm px-2 dark:group-hover:bg-white/20"
      >
        <Icon v-if="props.icon" :name="props.icon" />

        <span> {{ props.label }} </span>
      </span>
    </NuxtLink>
  </li>
</template>

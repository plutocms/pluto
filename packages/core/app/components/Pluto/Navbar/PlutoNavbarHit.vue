<script setup lang="ts">
import type { ButtonProps } from '@nuxt/ui'

defineProps<{
  label: string
  to?: string
  target?: string
  title?: string
  icon?: string
  disabled?: boolean
  size?: ButtonProps['size']
  square?: boolean
}>()
</script>

<template>
  <ULink
    :aria-label="label"
    :to="to"
    :target="target"
    :title="title"
    :disabled="disabled"
    class="group flex h-full shrink-0 items-center outline-none"
    raw
  >
    <UButton
      :icon="icon"
      :size="size"
      :square="square"
      as="span"
      class="group-hover:bg-elevated group-active:bg-elevated group-data-[state=open]:bg-elevated pointer-events-none group-focus-visible:outline-3"
      color="neutral"
      variant="ghost"
      aria-hidden="true"
      tabindex="-1"
    >
      <template v-if="$slots.default" #default>
        <slot />
      </template>
    </UButton>
  </ULink>
</template>

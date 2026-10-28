<script setup lang="ts">
import type { ButtonProps } from '@nuxt/ui'

// The click target of one control in the admin navbar. It fills the full
// height of the bar, so the whole height is clickable. The visible pill is a
// ghost UButton inside it. The pill is a <span> that takes no pointer events.
// It shows the hover, active and focus-visible look through the `group`
// classes of this element. Use it for every control in the bar. It renders a
// link when `to` is set, and a button when it is not. Extra attributes (an
// `@click`, a class) go on that element.
withDefaults(
  defineProps<{
    /** The accessible name. Required, because the pill can show only an icon. */
    label: string
    to?: string
    target?: string
    title?: string
    icon?: string
    disabled?: boolean
    size?: ButtonProps['size']
    square?: boolean
  }>(),
  { size: 'md' }
)
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
      class="group-hover:bg-elevated group-active:bg-elevated pointer-events-none group-focus-visible:outline-3"
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

<script setup lang="ts">
import { CALLOUT_ICON } from './constants'

interface Props {
  /** The look of the callout. */
  tone?: 'compact' | 'wide'
  dense?: boolean
}

defineProps<Props>()

definePlutoBlock<Props>({
  label: 'Callout',
  icon: CALLOUT_ICON,
  group: 'content',
})
</script>

<template>
  <div><slot mdc-unwrap="p" /></div>
</template>

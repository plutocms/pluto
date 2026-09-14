<script setup lang="ts">
withDefaults(
  defineProps<{
    /** Drop the max-width container in the main region. Default 'container'. */
    width?: 'container' | 'full'
  }>(),
  {
    width: 'container',
  }
)
</script>

<template>
  <div class="flex h-full min-h-0 flex-col overflow-hidden">
    <div class="shrink-0">
      <slot name="toolbar" />
    </div>

    <div class="flex flex-1 min-h-0 overflow-hidden">
      <main class="flex-1 min-h-0 overflow-y-auto">
        <!--
          'container' matches AdminView's own padding/gap classes, so a view
          moving from AdminView to this panel looks the same. 'full' adds
          none — a focus-layout consumer (e.g. a rich text editor) supplies
          its own padding instead.
        -->
        <UContainer
          v-if="width === 'container'"
          class="flex max-w-300 flex-col gap-y-6 px-4 py-6 sm:px-6 lg:gap-y-8 lg:px-8 lg:py-10"
        >
          <slot />
        </UContainer>
        <slot v-else />
      </main>

      <div class="shrink-0">
        <slot name="aside" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// Do NOT use UDashboardSidebar here. Nuxt UI's UDashboardSidebar listens to
// a GLOBAL `dashboard:sidebar:toggle` runtime hook, not a per-instance one.
// A second instance of it (this aside) would open and close in lockstep
// with the app's own LEFT sidebar from admin.vue. This component is a
// hand-built stand-in instead: a plain `<aside>` on desktop, a `USlideover`
// on mobile, both bound to the same `open` model.
withDefaults(
  defineProps<{
    title?: string
    /** Desktop width, in px. Default 320. */
    width?: number
  }>(),
  {
    width: 320,
  }
)

const open = defineModel<boolean>('open', { default: false })

function close() {
  open.value = false
}
</script>

<template>
  <aside
    v-if="open"
    :style="{ width: `${width}px` }"
    class="border-default hidden h-full shrink-0 flex-col border-s lg:flex"
  >
    <div class="border-default flex h-12 shrink-0 items-center justify-between gap-1.5 border-b px-4">
      <h2 class="text-highlighted truncate text-sm font-semibold">{{ title }}</h2>
      <UButton
        icon="i-lucide-x"
        color="neutral"
        variant="ghost"
        square
        @click="close"
      />
    </div>
    <div class="min-h-0 flex-1 overflow-y-auto p-4">
      <slot />
    </div>
  </aside>

  <USlideover
    v-model:open="open"
    :title="title"
    :ui="{ overlay: 'lg:hidden', content: 'lg:hidden' }"
    side="right"
  >
    <template #body>
      <slot />
    </template>
  </USlideover>
</template>

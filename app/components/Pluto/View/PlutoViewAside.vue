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
    /**
     * Desktop width, in px. Default 320. Ignored inside a
     * PlutoViewAdminPanel that gets `aside-open`: its resizable panel sets
     * the width.
     */
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

// Open the slideover on mobile only. A `lg:hidden` class alone is not
// enough: an open slideover is a modal dialog, so it disables pointer
// events on the rest of the page even while it is hidden. On desktop, the
// page then stops taking clicks as soon as the aside opens. It also mounts
// the slot a second time.
const isDesktop = useMediaQuery('(min-width: 64rem)')
const resizable = inject(plutoViewAsideResizableKey, ref(false))
const slideoverOpen = computed({
  get: () => open.value && !isDesktop.value,
  set: (value: boolean) => {
    open.value = value
  },
})
</script>

<template>
  <!--
    Inside a resizable PlutoViewAdminPanel the splitter panel owns the
    width and its handle draws the border. Elsewhere, keep the fixed width.
  -->
  <aside
    v-if="open"
    :style="resizable ? undefined : { width: `${width}px` }"
    :class="resizable ? 'w-full' : 'border-default shrink-0 border-s'"
    class="hidden h-full flex-col lg:flex"
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
    v-model:open="slideoverOpen"
    :title="title"
    side="right"
  >
    <template #body>
      <slot />
    </template>
  </USlideover>
</template>

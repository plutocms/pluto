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

const { t } = usePlutoI18n()

const open = defineModel<boolean>('open', { default: false })

function close() {
  open.value = false
}

// Render the plain aside on desktop only, and the slideover on mobile only,
// so the slot mounts once. CSS classes (`hidden lg:flex`, `lg:hidden`) are
// not enough: they hide a copy, but the copy stays mounted and fetches its
// own data. An open slideover is also a modal dialog. It disables pointer
// events on the rest of the page even while CSS hides it.
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
    v-if="open && isDesktop"
    :style="resizable ? undefined : { width: `${width}px` }"
    :class="resizable ? 'w-full' : 'border-default shrink-0 border-s'"
    class="flex h-full flex-col"
  >
    <div class="border-default flex h-12 shrink-0 items-center justify-between gap-1.5 border-b px-4">
      <h2 class="text-highlighted truncate text-sm font-semibold">{{ title }}</h2>
      <UTooltip :text="t('pluto.common.close')">
        <UButton
          :aria-label="t('pluto.common.close')"
          icon="i-lucide-x"
          color="neutral"
          variant="ghost"
          square
          @click="close"
        />
      </UTooltip>
    </div>
    <div class="min-h-0 flex-1 overflow-y-auto p-4">
      <slot />
    </div>
  </aside>

  <!--
    `unmount-on-hide="false"` keeps the slot mounted after the first open,
    so a reopen keeps the widget state (an open picker, a typed search) and
    does not fetch the field options again.
  -->
  <USlideover
    v-if="!isDesktop"
    v-model:open="slideoverOpen"
    :title="title"
    :unmount-on-hide="false"
    side="right"
  >
    <template #body>
      <slot />
    </template>
  </USlideover>
</template>

<script setup lang="ts">
import type { SplitterItem } from '@nuxt/ui'

const props = withDefaults(
  defineProps<{
    /** Drop the max-width container in the main region. Default 'container'. */
    width?: 'container' | 'full'
    /**
     * Whether the aside is open. Pass the same value as the aside's
     * `v-model:open`. While it is open on desktop, the aside sits in a
     * resizable panel. The panel width persists across visits.
     */
    asideOpen?: boolean
    /**
     * Fill the main region's height, and let the content scroll inside its
     * own region, not the whole page. For a view with one long scrolling
     * list, such as a virtualized table. Default false.
     */
    fill?: boolean
    /** The title of the left panel, when it shows as a slideover on a narrow screen. */
    leftTitle?: string
  }>(),
  {
    width: 'container',
    asideOpen: false,
    fill: false,
    leftTitle: undefined,
  }
)

/**
 * Whether the left panel is open. It is a panel beside the main content on
 * desktop, and a slideover on a narrow screen. It shows only when the view
 * fills the `#left` slot.
 */
const leftOpen = defineModel<boolean>('leftOpen', { default: false })

const slots = useSlots()

// `useSlots()` is not reactive. A view can fill a slot later, for example when
// a widget loads on demand and adds the left panel. So keep the slot flags in
// refs, and read the slots again before each update of this component.
const hasAsideSlot = ref(Boolean(slots.aside))
const hasLeftSlot = ref(Boolean(slots.left))
onBeforeUpdate(() => {
  hasAsideSlot.value = Boolean(slots.aside)
  hasLeftSlot.value = Boolean(slots.left)
})
const { t } = usePlutoI18n()
const isDesktop = useMediaQuery('(min-width: 64rem)')

// The splitter works in percentages of the row width. The side limits are in
// px, so convert them against the measured row width. Do not use the
// splitter's `sizeUnit: 'px'`: when a panel joins with its side already open
// (a reload), reka-ui skips the px conversion and reads the px value as a raw
// size.
const rowEl = ref<HTMLElement>()
const { width: rowWidth } = useElementSize(rowEl)
const toPercent = (px: number) => Math.min(100, (px / rowWidth.value) * 100)

// On mobile the aside is a slideover, so it needs no panel. Wait for the
// row to have a width, so the px-to-percent conversion is correct.
const resizable = computed(() => rowWidth.value > 0 && hasAsideSlot.value && props.asideOpen && isDesktop.value)
provide(plutoViewAsideResizableKey, resizable)

// The left panel sits in the splitter on desktop, with the same rule. On a
// narrow screen it is a slideover, outside the splitter.
const leftResizable = computed(() => rowWidth.value > 0 && hasLeftSlot.value && leftOpen.value && isDesktop.value)
const leftSlideover = computed(() => hasLeftSlot.value && !isDesktop.value)

// The collapse button in the header of the left panel (PlutoViewLeftCollapse).
const leftCollapseButtons = ref(0)
provide(plutoViewLeftPanelKey, {
  close: () => {
    leftOpen.value = false
  },
  collapseButtons: leftCollapseButtons,
})

defineExpose({
  /** True while a PlutoViewLeftCollapse button is in the left panel. */
  leftCollapsible: computed(() => leftCollapseButtons.value > 0),
})

const ASIDE_MIN = 240
const ASIDE_MAX = 560
const LEFT_MIN = 200
const LEFT_MAX = 400

// Keep the side widths in px ourselves, so they stay the same when the
// window size changes between visits.
const asideWidth = useCookie<number>('pluto-view-aside-width', { default: () => 320 })
const leftWidth = useCookie<number>('pluto-view-left-width', { default: () => 260 })
const asideEl = ref<HTMLElement>()
const leftEl = ref<HTMLElement>()

// Snapshot the width when a panel opens. A reactive `defaultSize` would
// rebuild the panel on every save.
const clamp = (px: number, min: number, max: number) => Math.min(max, Math.max(min, px))
const asideDefault = ref(0)
const leftDefault = ref(0)
watch(resizable, (value) => {
  if (value) {
    asideDefault.value = toPercent(clamp(asideWidth.value, ASIDE_MIN, ASIDE_MAX))
  }
}, { immediate: true })
watch(leftResizable, (value) => {
  if (value) {
    leftDefault.value = toPercent(clamp(leftWidth.value, LEFT_MIN, LEFT_MAX))
  }
}, { immediate: true })

function onDragging(_index: number, dragging: boolean) {
  if (dragging) {
    return
  }
  if (asideEl.value) {
    asideWidth.value = Math.round(asideEl.value.getBoundingClientRect().width)
  }
  if (leftEl.value) {
    leftWidth.value = Math.round(leftEl.value.getBoundingClientRect().width)
  }
}

// `id` and `order` let the splitter add and remove a side panel as it
// opens and closes. The order is left, main, aside.
const items = computed<SplitterItem[]>(() => [
  ...(leftResizable.value
    ? [{ id: 'pluto-view-left', slot: 'left', order: 1, defaultSize: leftDefault.value, minSize: toPercent(LEFT_MIN), maxSize: toPercent(LEFT_MAX) }]
    : []),
  { id: 'pluto-view-main', slot: 'main', order: 2 },
  ...(resizable.value
    ? [{ id: 'pluto-view-aside', slot: 'aside', order: 3, defaultSize: asideDefault.value, minSize: toPercent(ASIDE_MIN), maxSize: toPercent(ASIDE_MAX) }]
    : []),
])
</script>

<template>
  <div class="flex h-full min-h-0 flex-col overflow-hidden">
    <div class="shrink-0">
      <slot name="toolbar" />
    </div>

    <div ref="rowEl" class="flex min-h-0 flex-1 overflow-hidden">
      <USplitter
        id="pluto-view"
        :items="items"
        :ui="{
          root: 'min-h-0 flex-1',
          handle: 'w-px bg-(--ui-border) transition-colors hover:bg-primary data-[resize-handle-state=drag]:bg-primary',
        }"
        @dragging="onDragging"
      >
        <template #left>
          <div ref="leftEl" class="flex h-full w-full flex-col overflow-y-auto">
            <slot name="left" />
          </div>
        </template>

        <template #main>
          <main :class="fill ? 'flex flex-col overflow-hidden' : 'overflow-y-auto'" class="min-h-0 w-full">
            <!--
              'container' matches AdminView's own padding/gap classes, so a view
              moving from AdminView to this panel looks the same. 'full' adds
              none — a focus-layout consumer (e.g. a rich text editor) supplies
              its own padding instead.
            -->
            <UContainer
              v-if="width === 'container'"
              :class="{ 'h-full min-h-0': fill }"
              class="flex max-w-300 flex-col gap-y-6 px-4 py-6 sm:px-6 lg:gap-y-8 lg:px-8 lg:py-10"
            >
              <slot />
            </UContainer>
            <slot v-else />
          </main>
        </template>

        <template #aside>
          <div ref="asideEl" class="h-full w-full">
            <slot name="aside" />
          </div>
        </template>
      </USplitter>

      <!-- Closed or mobile: the aside renders outside the splitter. -->
      <div v-if="!resizable" class="shrink-0">
        <slot name="aside" />
      </div>
    </div>

    <!--
      The left panel on a narrow screen. Like PlutoViewAside, it renders the
      slot once: here on a narrow screen, in the splitter on desktop.
      `unmount-on-hide="false"` keeps the slot mounted after the first open.
    -->
    <USlideover
      v-if="leftSlideover"
      v-model:open="leftOpen"
      :title="leftTitle ?? t('pluto.canvas.sidebar')"
      :description="leftTitle ?? t('pluto.canvas.sidebar')"
      :unmount-on-hide="false"
      :ui="{ description: 'sr-only' }"
      side="left"
    >
      <template #body>
        <div class="flex flex-col">
          <slot name="left" />
        </div>
      </template>
    </USlideover>
  </div>
</template>

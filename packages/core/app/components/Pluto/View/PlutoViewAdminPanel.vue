<script setup lang="ts">
import type { SplitterItem } from '@nuxt/ui'

withDefaults(
  defineProps<{
    /** Drop the max-width container in the main region. Default 'container'. */
    width?: 'container' | 'full'
    /**
     * Fill the main region's height, and let the content scroll inside its
     * own region, not the whole page. For a view with one long scrolling
     * list, such as a virtualized table. Default false.
     */
    fill?: boolean
    /** The title of the left panel, when it shows as a slideover on a narrow screen. */
    leftTitle?: string
    /**
     * On desktop, show a small floating button that opens a closed side panel, at the place of
     * the collapse button in the panel header. Needs `v-model:aside-open` for the aside.
     * Default false.
     */
    panelToggles?: boolean
  }>(),
  {
    width: 'container',
    fill: false,
    leftTitle: undefined,
    panelToggles: false,
  }
)

/**
 * Whether the left panel is open. It is a panel beside the main content on
 * desktop, and a slideover on a narrow screen. It shows only when the view
 * fills the `#left` slot.
 */
const leftOpen = defineModel<boolean>('leftOpen', { default: false })

/**
 * Whether the aside is open. Pass the same value as the aside's `v-model:open`. While it is
 * open on desktop, the aside sits in a resizable panel. The panel width persists across visits.
 */
const asideOpen = defineModel<boolean>('asideOpen', { default: false })

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
const resizable = computed(
  () =>
    rowWidth.value > 0 &&
    hasAsideSlot.value &&
    asideOpen.value &&
    isDesktop.value
)
provide(plutoViewAsideResizableKey, resizable)

// The left panel sits in the splitter on desktop, with the same rule. On a
// narrow screen it is a slideover, outside the splitter.
const leftResizable = computed(
  () =>
    rowWidth.value > 0 && hasLeftSlot.value && leftOpen.value && isDesktop.value
)
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
const asideWidth = useCookie<number>('pluto-view-aside-width', {
  default: () => 320,
})
const leftWidth = useCookie<number>('pluto-view-left-width', {
  default: () => 260,
})
const asideEl = ref<HTMLElement>()
const leftEl = ref<HTMLElement>()

// Snapshot the width when a panel opens. A reactive `defaultSize` would
// rebuild the panel on every save.
const clamp = (px: number, min: number, max: number) =>
  Math.min(max, Math.max(min, px))
const asideDefault = ref(0)
const leftDefault = ref(0)
watch(
  resizable,
  (value) => {
    if (value) {
      asideDefault.value = toPercent(
        clamp(asideWidth.value, ASIDE_MIN, ASIDE_MAX)
      )
    }
  },
  { immediate: true }
)
watch(
  leftResizable,
  (value) => {
    if (value) {
      leftDefault.value = toPercent(clamp(leftWidth.value, LEFT_MIN, LEFT_MAX))
    }
  },
  { immediate: true }
)

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
    ? [
        {
          id: 'pluto-view-left',
          slot: 'left',
          order: 1,
          defaultSize: leftDefault.value,
          minSize: toPercent(LEFT_MIN),
          maxSize: toPercent(LEFT_MAX),
        },
      ]
    : []),
  { id: 'pluto-view-main', slot: 'main', order: 2 },
  ...(resizable.value
    ? [
        {
          id: 'pluto-view-aside',
          slot: 'aside',
          order: 3,
          defaultSize: asideDefault.value,
          minSize: toPercent(ASIDE_MIN),
          maxSize: toPercent(ASIDE_MAX),
        },
      ]
    : []),
])
</script>

<template>
  <div class="flex h-full min-h-0 flex-col overflow-hidden" data-pluto-view>
    <div class="shrink-0">
      <slot name="toolbar" />
    </div>

    <div ref="rowEl" class="relative flex min-h-0 flex-1 overflow-hidden">
      <!--
        No `id` on the splitter, on purpose. With an id, Nuxt UI names each handle
        `<id>-handle-<index>`, and reka-ui reads that name once, when the handle mounts. A panel
        that joins later (the left panel of the canvas layout loads on demand) shifts the indexes,
        so two handles get the same name, and a drag on the aside handle resized the left panel.
        Without an id, reka-ui gives each handle its own unique id. The panels keep their `id`s.
      -->
      <USplitter
        :items="items"
        :ui="{
          root: 'min-h-0 flex-1',
          // A 1px line. A `::before` 2.5px wider on each side is the 6px grab
          // area, and the 6px haze-400 bar: it fades in after 300ms of hover, and
          // shows at once while dragging. The `!` keeps the duration and the
          // delay against the no-transition rule of the admin (pluto-layer.css).
          handle:
            'w-px bg-border before:absolute before:inset-y-0 before:inset-x-[-2.5px] before:z-10 before:transition-colors before:duration-150! hover:before:bg-haze-400 hover:before:delay-300! data-[resize-handle-state=drag]:before:bg-haze-400 data-[resize-handle-state=drag]:before:delay-0!',
        }"
        @dragging="onDragging"
      >
        <template #left>
          <div ref="leftEl" class="flex size-full flex-col overflow-y-auto">
            <slot name="left" />
          </div>
        </template>

        <template #main>
          <!--
            `scrollbar-gutter: stable` keeps the space of the scrollbar on a short page too, so
            the content does not move sideways between a short and a long page.
          -->
          <main
            :class="
              fill
                ? 'flex flex-col overflow-hidden'
                : 'scrollbar-gutter-stable overflow-y-auto'
            "
            class="min-h-0 w-full"
          >
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
          <div ref="asideEl" class="size-full">
            <slot name="aside" />
          </div>
        </template>
      </USplitter>

      <!-- Closed or mobile: the aside renders outside the splitter. -->
      <div v-if="!resizable" class="shrink-0">
        <slot name="aside" />
      </div>

      <!--
        A closed side panel opens again from a small square button at the place of the collapse
        button in its header. Desktop only: on a narrow screen the toolbar opens the slideovers.
      -->
      <template v-if="panelToggles && isDesktop">
        <UTooltip
          v-if="hasLeftSlot && !leftOpen"
          :text="t('pluto.canvas.showSidebar')"
        >
          <UButton
            :aria-label="t('pluto.canvas.showSidebar')"
            icon="lucide:panel-left-open"
            color="neutral"
            variant="outline"
            size="sm"
            class="absolute top-2.5 left-3 z-10 shadow-sm"
            square
            @click="leftOpen = true"
          />
        </UTooltip>
        <UTooltip
          v-if="hasAsideSlot && !asideOpen"
          :text="t('pluto.common.showPanel')"
        >
          <UButton
            :aria-label="t('pluto.common.showPanel')"
            icon="lucide:panel-right-open"
            color="neutral"
            variant="outline"
            size="sm"
            class="absolute top-2.5 right-4 z-10 shadow-sm"
            square
            @click="asideOpen = true"
          />
        </UTooltip>
      </template>
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

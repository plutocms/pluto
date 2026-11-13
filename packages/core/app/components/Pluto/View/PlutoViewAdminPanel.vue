<script setup lang="ts">
import type { SplitterItem } from '@nuxt/ui'

withDefaults(
  defineProps<{
    /**
     * The main region: 'container' (the padding, the gap and the max width of every admin page),
     * 'narrow' (the same, in a reading width: a settings-like form), or 'full' (none). Default
     * 'container'.
     */
    width?: 'container' | 'narrow' | 'full'
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

// `useSlots()` is not reactive. Keep the slot flags in refs.
const hasAsideSlot = ref(Boolean(slots.aside))
const hasLeftSlot = ref(Boolean(slots.left))
const hasRailSlot = ref(Boolean(slots.rail))
onBeforeUpdate(() => {
  hasAsideSlot.value = Boolean(slots.aside)
  hasLeftSlot.value = Boolean(slots.left)
  hasRailSlot.value = Boolean(slots.rail)
})
const { t } = usePlutoI18n()
const isDesktop = useMediaQuery('(min-width: 64rem)')

// Do not use the splitter's `sizeUnit: 'px'`. When a panel joins already open, reka-ui skips the px conversion.
interface SplitterPanelInstance {
  resize: (size: number) => void
}
const splitter = useTemplateRef<{
  panelsRef: Array<SplitterPanelInstance | null | undefined>
}>('splitter')
const rowEl = ref<HTMLElement>()
const railEl = ref<HTMLElement>()
const { width: rowWidth } = useElementSize(rowEl)
const splitWidth = computed(
  () => rowWidth.value - (railEl.value?.offsetWidth ?? 0)
)
const toPercent = (px: number) => Math.min(100, (px / splitWidth.value) * 100)

const resizable = computed(
  () =>
    rowWidth.value > 0 &&
    hasAsideSlot.value &&
    asideOpen.value &&
    isDesktop.value
)
provide(plutoViewAsideResizableKey, resizable)

const leftResizable = computed(
  () =>
    rowWidth.value > 0 && hasLeftSlot.value && leftOpen.value && isDesktop.value
)
const leftSlideover = computed(() => hasLeftSlot.value && !isDesktop.value)
usePlutoBackClose(
  computed({
    get: () => leftSlideover.value && leftOpen.value,
    set: (value: boolean) => {
      leftOpen.value = value
    },
  })
)

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

const asideWidth = useCookie<number>('pluto-view-aside-width', {
  default: () => 300,
})
const leftWidth = useCookie<number>('pluto-view-left-width', {
  default: () => 260,
})
const asideEl = ref<HTMLElement>()
const leftEl = ref<HTMLElement>()

const clamp = (px: number, min: number, max: number) =>
  Math.min(max, Math.max(min, px))
const asideDefault = ref(0)
const leftDefault = ref(0)

function sideWidth(el: HTMLElement | undefined, stored: number) {
  const width = el?.getBoundingClientRect().width
  return width && width > 0 ? width : stored
}

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

const sheet = computed(() => hasRailSlot.value && isDesktop.value)

const items = computed<SplitterItem[]>(() => [
  ...(leftResizable.value
    ? [
        {
          id: 'pluto-view-left',
          slot: 'left',
          order: 1,
          class: sheet.value ? 'rounded-ss-xl' : undefined,
          defaultSize: leftDefault.value,
          minSize: toPercent(LEFT_MIN),
          maxSize: toPercent(LEFT_MAX),
        },
      ]
    : []),
  {
    id: 'pluto-view-main',
    slot: 'main',
    order: 2,
    class: sheet.value
      ? leftResizable.value
        ? 'rounded-se-xl'
        : 'rounded-ss-xl rounded-se-xl'
      : undefined,
  },
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

function restoreSideWidths(asidePx: number, leftPx: number) {
  const panels = splitter.value?.panelsRef ?? []
  const panelOf = (id: string) => {
    const index = items.value.findIndex((item) => item.id === id)
    return index < 0 ? undefined : panels[index]
  }
  if (resizable.value) {
    panelOf('pluto-view-aside')?.resize(toPercent(asidePx))
  }
  if (leftResizable.value) {
    panelOf('pluto-view-left')?.resize(toPercent(leftPx))
  }
}

watch(
  [resizable, leftResizable],
  ([aside, left], previous) => {
    const asidePx = clamp(
      sideWidth(asideEl.value, asideWidth.value),
      ASIDE_MIN,
      ASIDE_MAX
    )
    const leftPx = clamp(
      sideWidth(leftEl.value, leftWidth.value),
      LEFT_MIN,
      LEFT_MAX
    )
    if (aside) {
      asideDefault.value = toPercent(asidePx)
    }
    if (left) {
      leftDefault.value = toPercent(leftPx)
    }
    if (previous) {
      nextTick(() => restoreSideWidths(asidePx, leftPx))
    }
  },
  { immediate: true }
)
</script>

<template>
  <div
    :class="sheet && 'bg-pluto-frame'"
    class="flex h-full min-h-0 flex-col overflow-hidden"
    data-pluto-view
  >
    <div :class="sheet && '*:border-b-transparent'" class="shrink-0">
      <slot name="toolbar" />
    </div>

    <div ref="rowEl" class="relative flex min-h-0 flex-1 overflow-hidden">
      <nav
        v-if="hasRailSlot && isDesktop"
        ref="railEl"
        :aria-label="t('pluto.canvas.actions')"
        class="bg-pluto-rail flex w-12 shrink-0 flex-col items-center gap-1 py-2"
      >
        <slot name="rail" />
      </nav>

      <USplitter
        ref="splitter"
        :items="items"
        :hit-area-margins="{ coarse: 15, fine: 2.5 }"
        :ui="{
          root: sheet && !resizable ? 'min-h-0 flex-1 pe-4' : 'min-h-0 flex-1',
          panel: sheet ? 'overflow-hidden' : undefined,
          // The `!` keeps the duration and delay against the no-transition rule of the admin (pluto-layer.css).
          handle: [
            sheet
              ? 'bg-transparent [#pluto-view-left+&]:bg-border'
              : 'bg-border',
            'w-px before:absolute before:inset-y-0 before:inset-x-[-2.5px] before:z-10 before:transition-colors before:duration-150! hover:before:bg-haze-400 hover:before:delay-300! data-[resize-handle-state=drag]:before:bg-haze-400 data-[resize-handle-state=drag]:before:delay-0!',
          ].join(' '),
        }"
        @dragging="onDragging"
      >
        <template #left>
          <div ref="leftEl" class="flex size-full flex-col overflow-y-auto">
            <slot name="left" />
          </div>
        </template>

        <template #main>
          <main
            :class="
              fill
                ? 'flex flex-col overflow-hidden'
                : 'scrollbar-gutter-stable overflow-y-auto'
            "
            class="min-h-0 w-full"
          >
            <UContainer
              v-if="width !== 'full'"
              :class="[
                width === 'narrow' ? 'max-w-3xl' : 'max-w-300',
                { 'h-full min-h-0': fill },
              ]"
              class="flex flex-col gap-y-6 px-4 py-6 sm:px-6 lg:gap-y-8 lg:px-8 lg:py-10"
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

      <div v-if="!resizable" class="shrink-0">
        <slot name="aside" />
      </div>

      <template v-if="panelToggles && isDesktop">
        <UTooltip
          v-if="hasLeftSlot && !leftOpen && !hasRailSlot"
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
            :class="sheet ? 'right-6' : 'right-4'"
            icon="lucide:panel-right-open"
            color="neutral"
            variant="outline"
            size="sm"
            class="absolute top-2.5 z-10 shadow-sm"
            square
            @click="asideOpen = true"
          />
        </UTooltip>
      </template>
    </div>

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

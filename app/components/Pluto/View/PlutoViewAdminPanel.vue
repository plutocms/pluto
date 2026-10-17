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
  }>(),
  {
    width: 'container',
    asideOpen: false,
    fill: false,
  }
)

const slots = useSlots()
const isDesktop = useMediaQuery('(min-width: 64rem)')

// The splitter works in percentages of the row width. The aside limits
// are in px, so convert them against the measured row width. Do not use
// the splitter's `sizeUnit: 'px'`: when the panel joins with the aside
// already open (a reload), reka-ui skips the px conversion and reads the
// px value as a raw size.
const rowEl = ref<HTMLElement>()
const { width: rowWidth } = useElementSize(rowEl)
const toPercent = (px: number) => Math.min(100, (px / rowWidth.value) * 100)

// On mobile the aside is a slideover, so it needs no panel. Wait for the
// row to have a width, so the px-to-percent conversion is correct.
const resizable = computed(() => rowWidth.value > 0 && Boolean(slots.aside) && props.asideOpen && isDesktop.value)
provide(plutoViewAsideResizableKey, resizable)

const ASIDE_MIN = 240
const ASIDE_MAX = 560

// Keep the aside width in px ourselves, so it stays the same when the
// window size changes between visits.
const asideWidth = useCookie<number>('pluto-view-aside-width', { default: () => 320 })
const asideEl = ref<HTMLElement>()

// Snapshot the width when the panel opens. A reactive `defaultSize` would
// rebuild the panel on every save.
const clampAside = (px: number) => Math.min(ASIDE_MAX, Math.max(ASIDE_MIN, px))
const asideDefault = ref(0)
watch(resizable, (value) => {
  if (value) {
    asideDefault.value = toPercent(clampAside(asideWidth.value))
  }
}, { immediate: true })

function onDragging(_index: number, dragging: boolean) {
  if (!dragging && asideEl.value) {
    asideWidth.value = Math.round(asideEl.value.getBoundingClientRect().width)
  }
}

// `id` and `order` let the splitter add and remove the aside panel as the
// aside opens and closes.
const items = computed<SplitterItem[]>(() => [
  { id: 'pluto-view-main', slot: 'main', order: 1 },
  ...(resizable.value
    ? [{ id: 'pluto-view-aside', slot: 'aside', order: 2, defaultSize: asideDefault.value, minSize: toPercent(ASIDE_MIN), maxSize: toPercent(ASIDE_MAX) }]
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
  </div>
</template>

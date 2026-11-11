<script setup lang="ts">
import type { EditorToolbarItem } from '@nuxt/ui'
import type { Editor } from '@tiptap/vue-3'

// The toolbar of a rich text editor in one row. The buttons that do not fit go into a "More"
// popover at the end of the row, as the same buttons, so a narrow panel shows no second row and
// no empty space. The groups keep their separators. The slots of the items (a link button, the
// media button, the component menu) work in both places: the parent passes them as slots here.
//
// Every button of the toolbar has the same width (the icon buttons of `UEditorToolbar` and of the
// slots), so the split reads the width of one button and of one separator, then counts.
const props = defineProps<{
  editor: Editor
  items: EditorToolbarItem[][]
  ariaLabel?: string
}>()

const slots = useSlots()
const { t } = usePlutoI18n()

const row = useTemplateRef<HTMLElement>('row')
const { width } = useElementSize(row)

// The sizes in px. A first render measures the real button and separator.
const sizes = ref({ item: 28, separator: 9, gap: 2 })
function measure() {
  const el = row.value
  if (!el) {
    return
  }
  const button = el.querySelector<HTMLElement>('[data-slot="base"] button')
  const separator = el.querySelector<HTMLElement>('[data-slot="separator"]')
  const base = el.querySelector<HTMLElement>('[data-slot="base"]')
  const gap = base ? Number.parseFloat(getComputedStyle(base).columnGap) : NaN
  sizes.value = {
    item: button?.offsetWidth || sizes.value.item,
    separator: separator
      ? separator.offsetWidth +
        Number.parseFloat(getComputedStyle(separator).marginInlineStart) +
        Number.parseFloat(getComputedStyle(separator).marginInlineEnd)
      : sizes.value.separator,
    gap: Number.isFinite(gap) ? gap : sizes.value.gap,
  }
}
onMounted(() => nextTick(measure))

/** The width of some groups in one row. */
function rowWidth(groups: EditorToolbarItem[][]): number {
  const { item, separator, gap } = sizes.value
  const count = groups.reduce((sum, group) => sum + group.length, 0)
  const separators = Math.max(groups.filter((g) => g.length).length - 1, 0)
  const children = count + separators
  return count * item + separators * separator + Math.max(children - 1, 0) * gap
}

const split = computed(() => {
  const all = props.items.filter((group) => group.length > 0)
  // Not measured yet (0), or everything fits: one row with all the buttons.
  if (width.value === 0 || rowWidth(all) <= width.value) {
    return { visible: all, overflow: [] as EditorToolbarItem[][] }
  }
  // Room for the More button and its gap.
  const room = width.value - sizes.value.item - sizes.value.gap
  const visible: EditorToolbarItem[][] = []
  const overflow: EditorToolbarItem[][] = []
  let full = false
  for (const group of all) {
    if (full) {
      overflow.push(group)
      continue
    }
    const kept: EditorToolbarItem[] = []
    for (const [index, entry] of group.entries()) {
      if (rowWidth([...visible, [...kept, entry]]) > room) {
        full = true
        const rest = group.slice(index)
        if (rest.length) {
          overflow.push(rest)
        }
        break
      }
      kept.push(entry)
    }
    if (kept.length) {
      visible.push(kept)
    }
  }
  return { visible, overflow }
})

// The names of the item slots that the parent fills (`link`, `image`, `component`, ...).
const slotNames = computed(() => Object.keys(slots))
</script>

<template>
  <div ref="row" class="flex min-w-0 items-center gap-0.5">
    <UEditorToolbar
      :editor="editor"
      :items="split.visible"
      :aria-label="ariaLabel"
      :ui="{
        root: 'min-w-0',
        base: 'flex-nowrap items-center gap-0.5',
        group: 'contents',
        separator: 'mx-1 h-5 self-center',
      }"
    >
      <template v-for="name in slotNames" :key="name" #[name]="scope">
        <slot :name="name" v-bind="scope ?? {}" />
      </template>
    </UEditorToolbar>

    <UPopover v-if="split.overflow.length" :content="{ align: 'end' }" arrow>
      <UTooltip :text="t('pluto.markdown.moreTools')">
        <UButton
          :aria-label="t('pluto.markdown.moreTools')"
          icon="i-lucide-ellipsis"
          color="neutral"
          variant="ghost"
          size="sm"
          class="ms-auto shrink-0"
          square
        />
      </UTooltip>

      <template #content>
        <UEditorToolbar
          :editor="editor"
          :items="split.overflow"
          :aria-label="t('pluto.markdown.moreTools')"
          :ui="{
            root: 'max-w-64 p-1',
            base: 'flex-wrap items-center gap-0.5',
            group: 'contents',
            separator: 'mx-1 h-5 self-center',
          }"
        >
          <template v-for="name in slotNames" :key="name" #[name]="scope">
            <slot :name="name" v-bind="scope ?? {}" />
          </template>
        </UEditorToolbar>
      </template>
    </UPopover>
  </div>
</template>

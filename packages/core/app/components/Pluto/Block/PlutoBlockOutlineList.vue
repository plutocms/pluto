<script setup lang="ts">
import type { PlutoBlock } from '#layers/pluto/shared/utils/blocks/types'
import { resolveSlotMode } from '#layers/pluto/shared/utils/blocks/editor'

const props = defineProps<{
  blocks: PlutoBlock[]
  parentId?: string
  slotName?: string
  level?: number
}>()

const editor = usePlutoBlockEditor()
const { t, tx } = usePlutoI18n()
const { slotLabel, addLabel } = usePlutoBlockLabels()

const list = useTemplateRef<HTMLElement>('list')
const level = computed(() => props.level ?? 1)

function info(block: PlutoBlock) {
  const described = editor.describe(block)
  return { ...described, label: tx(described.label) }
}

interface PlutoBlockChildList {
  slot: string
  blocks: PlutoBlock[]
  title: string
  add: string
}

const hasChevrons = computed(() =>
  props.blocks.some((block) => childLists(block).length > 0)
)

function childLists(block: PlutoBlock): PlutoBlockChildList[] {
  if (block.kind !== 'component') {
    return []
  }
  const definition = editor.definitionOf(block)
  return Object.entries(block.slots)
    .filter(
      ([slot]) =>
        resolveSlotMode(block, slot, definition?.slots?.[slot]?.content) ===
        'blocks'
    )
    .map(([slot, blocks]) => ({
      slot,
      blocks,
      title: slotLabel(definition, slot),
      add: addLabel(definition, slot),
    }))
    .filter((entry) => entry.blocks.length > 0)
}

function menu(block: PlutoBlock, index: number) {
  const siblings = editor.siblings(block.id)
  return [
    [
      {
        label: t('pluto.blocks.editor.moveUp'),
        icon: 'i-lucide-arrow-up',
        disabled: index === 0,
        onSelect: () => editor.move(block.id, -1),
      },
      {
        label: t('pluto.blocks.editor.moveDown'),
        icon: 'i-lucide-arrow-down',
        disabled: index >= siblings.length - 1,
        onSelect: () => editor.move(block.id, 1),
      },
      {
        label: t('pluto.blocks.editor.addBelow'),
        icon: 'i-lucide-plus',
        onSelect: () =>
          editor.openPalette({
            parentId: props.parentId,
            slot: props.slotName,
            index: index + 1,
          }),
      },
      {
        label: t('pluto.blocks.editor.duplicate'),
        icon: 'i-lucide-copy',
        onSelect: () => editor.duplicate(block.id),
      },
    ],
    [
      {
        label: t('pluto.blocks.editor.delete'),
        icon: 'i-lucide-trash-2',
        color: 'error' as const,
        onSelect: () => editor.remove(block.id),
      },
    ],
  ]
}

function focusRow(from: HTMLElement, delta: number) {
  const root = from.closest<HTMLElement>('[data-block-outline]')
  const rows = [
    ...(root?.querySelectorAll<HTMLElement>('[data-block-row]') ?? []),
  ]
  rows[rows.indexOf(from) + delta]?.focus()
}

function onKeydown(event: KeyboardEvent, block: PlutoBlock) {
  const target = event.currentTarget as HTMLElement
  if (event.altKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
    event.preventDefault()
    editor.move(block.id, event.key === 'ArrowUp' ? -1 : 1)
    nextTick(() =>
      document
        .querySelector<HTMLElement>(
          `[data-block-row="${CSS.escape(block.id)}"]`
        )
        ?.focus()
    )
    return
  }
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault()
    focusRow(target, event.key === 'ArrowUp' ? -1 : 1)
  } else if (
    (event.key === 'ArrowLeft' || event.key === 'ArrowRight') &&
    childLists(block).length
  ) {
    const collapsed = editor.collapsedIds.value.has(block.id)
    if (collapsed === (event.key === 'ArrowRight')) {
      event.preventDefault()
      editor.toggleCollapsed(block.id)
    }
  } else if (event.key === 'Delete') {
    event.preventDefault()
    editor.remove(block.id)
    nextTick(() => {
      const next = editor.selectedId.value
      document
        .querySelector<HTMLElement>(
          next ? `[data-block-row="${CSS.escape(next)}"]` : '[data-block-row]'
        )
        ?.focus()
    })
  }
}

let sortable: { destroy: () => void } | undefined

onMounted(async () => {
  const { default: Sortable } = await import('sortablejs')
  if (!list.value) {
    return
  }
  sortable = Sortable.create(list.value, {
    handle: '[data-block-drag]',
    filter: '[data-block-nodrag]',
    preventOnFilter: false,
    fallbackTolerance: 4,
    delay: 200,
    delayOnTouchOnly: true,
    draggable: 'li',
    animation: 150,
    ghostClass: 'opacity-40',
    forceFallback: true,
    fallbackOnBody: true,
    group: `blocks:${props.parentId ?? 'root'}:${props.slotName ?? 'default'}`,
    onEnd(event) {
      const { oldIndex, newIndex, item, from } = event
      if (
        oldIndex === undefined ||
        newIndex === undefined ||
        oldIndex === newIndex
      ) {
        return
      }
      item.remove()
      from.insertBefore(item, from.children[oldIndex] ?? null)
      const block = props.blocks[oldIndex]
      if (block) {
        editor.moveTo(block.id, {
          parentId: props.parentId,
          slot: props.slotName,
          index: newIndex,
        })
      }
    },
  })
})

onBeforeUnmount(() => sortable?.destroy())
</script>

<template>
  <ul ref="list" :data-level="level" class="flex flex-col gap-0.5">
    <li v-for="(block, index) in blocks" :key="block.id">
      <div
        :class="
          editor.selectedId.value === block.id
            ? 'bg-primary/10 ring-1 ring-inset ring-primary/40'
            : editor.hoverId.value === block.id
              ? 'bg-elevated'
              : 'hover:bg-elevated/60'
        "
        class="group flex items-center gap-0.5 rounded-md pe-0.5 ps-0.5 transition-colors"
        data-block-drag
      >
        <button
          v-if="childLists(block).length"
          :aria-expanded="!editor.collapsedIds.value.has(block.id)"
          :aria-label="
            t(
              editor.collapsedIds.value.has(block.id)
                ? 'pluto.blocks.editor.expand'
                : 'pluto.blocks.editor.collapse',
              { name: info(block).label }
            )
          "
          type="button"
          class="flex size-4 shrink-0 items-center justify-center rounded text-muted hover:text-highlighted focus-visible:outline-2 focus-visible:outline-primary"
          data-block-nodrag
          @click="editor.toggleCollapsed(block.id)"
        >
          <UIcon
            :class="editor.collapsedIds.value.has(block.id) ? '' : 'rotate-90'"
            name="i-lucide-chevron-right"
            class="size-4 transition-transform"
          />
        </button>
        <span
          v-else-if="hasChevrons"
          class="size-4 shrink-0"
          aria-hidden="true"
        />

        <button
          :data-block-row="block.id"
          :aria-current="
            editor.selectedId.value === block.id ? 'true' : undefined
          "
          type="button"
          aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown ArrowLeft ArrowRight Delete"
          class="flex min-h-8 min-w-0 flex-1 items-center gap-2 rounded p-1 text-start text-sm focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
          @click="editor.select(block.id)"
          @keydown="onKeydown($event, block)"
        >
          <UIcon :name="info(block).icon" class="size-4 shrink-0 text-muted" />
          <span
            :title="
              info(block).excerpt
                ? `${info(block).label}: ${info(block).excerpt}`
                : info(block).label
            "
            class="min-w-0 flex-1 truncate"
          >
            <span class="text-highlighted">{{ info(block).label }}</span>
            <span v-if="info(block).excerpt" class="text-muted">
              : {{ info(block).excerpt }}
            </span>
          </span>
          <span
            v-if="editor.editedIds.value.has(block.id)"
            :aria-label="t('pluto.blocks.editor.edited')"
            :title="t('pluto.blocks.editor.edited')"
            class="size-1.5 shrink-0 rounded-full bg-primary"
            role="img"
          />
        </button>

        <UDropdownMenu :items="menu(block, index)" :content="{ align: 'end' }">
          <UTooltip
            :text="t('pluto.blocks.editor.blockActions', { name: info(block).label })"
          >
            <UButton
              :aria-label="
                t('pluto.blocks.editor.blockActions', { name: info(block).label })
              "
              icon="i-lucide-ellipsis"
              color="neutral"
              variant="ghost"
              size="xs"
              class="shrink-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 data-[state=open]:opacity-100 [@media(hover:hover)]:opacity-0"
              data-block-nodrag
            />
          </UTooltip>
        </UDropdownMenu>
      </div>

      <div
        v-if="
          childLists(block).length && !editor.collapsedIds.value.has(block.id)
        "
        class="ms-2.5 border-s border-default ps-1"
      >
        <div
          v-for="child in childLists(block)"
          :key="child.slot"
          class="pt-0.5"
        >
          <p
            v-if="childLists(block).length > 1"
            class="px-1 pt-1 text-xs font-medium text-muted"
          >
            {{ child.title }}
          </p>
          <PlutoBlockOutlineList
            :blocks="child.blocks"
            :parent-id="block.id"
            :slot-name="child.slot"
            :level="level + 1"
          />
          <UButton
            :label="child.add"
            icon="i-lucide-plus"
            color="neutral"
            variant="link"
            size="xs"
            class="ms-5"
            @click="
              editor.openPalette({
                parentId: block.id,
                slot: child.slot,
                index: child.blocks.length,
              })
            "
          />
        </div>
      </div>
    </li>
  </ul>
</template>

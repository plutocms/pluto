<script setup lang="ts">
import {
  ScrollAreaRoot,
  ScrollAreaScrollbar,
  ScrollAreaThumb,
  ScrollAreaViewport,
} from 'reka-ui'

// The left panel of the post editor: the outline of the post (its headings) and,
// in the footer, the switch between the Visual and the Markdown editor. A click on
// a heading jumps to it in the editor and in the preview.
const props = defineProps<{
  headings: PlutoMarkdownHeading[]
  mode: 'visual' | 'markdown'
  disabled?: boolean
  /** The text has Markdown that the visual editor cannot keep: Visual is off. */
  visualBlocked?: boolean
}>()

const emit = defineEmits<{
  select: [index: number]
  'update:mode': [mode: 'visual' | 'markdown']
}>()

const { t } = usePlutoI18n()

// The smallest level of the post is the left edge, so a post that starts at `##` is not indented.
const baseLevel = computed(() =>
  props.headings.reduce((min, heading) => Math.min(min, heading.level), 6)
)

function pick(mode: 'visual' | 'markdown') {
  if (mode !== props.mode) {
    emit('update:mode', mode)
  }
}
</script>

<template>
  <div
    :aria-label="t('pluto.post.outline')"
    class="flex min-h-0 flex-1 flex-col bg-white dark:bg-[#0b0b0b]"
    role="region"
  >
    <div
      class="border-default flex h-12 shrink-0 items-center gap-1 border-b px-3"
    >
      <h2
        class="text-highlighted min-w-0 truncate text-sm font-semibold max-lg:hidden"
      >
        {{ t('pluto.post.outline') }}
      </h2>
      <div class="ms-auto flex items-center gap-1">
        <PlutoViewLeftCollapse />
      </div>
    </div>

    <ScrollAreaRoot
      type="hover"
      class="relative min-h-0 flex-1 overflow-hidden"
    >
      <ScrollAreaViewport class="size-full">
        <nav v-if="headings.length" class="flex flex-col gap-0.5 p-2">
          <button
            v-for="(heading, index) in headings"
            :key="`${heading.line}-${index}`"
            :style="{
              paddingInlineStart: `${0.5 + (heading.level - baseLevel) * 0.875}rem`,
            }"
            :class="
              heading.level === baseLevel
                ? 'text-highlighted font-medium'
                : 'text-default'
            "
            type="button"
            class="hover:bg-elevated/60 focus-visible:outline-primary flex min-h-8 w-full items-center rounded-md py-1 pe-2 text-start text-sm focus-visible:outline-2 focus-visible:-outline-offset-2"
            @click="emit('select', index)"
          >
            <span class="min-w-0 truncate">{{ heading.text }}</span>
          </button>
        </nav>
        <UEmpty
          v-else
          :title="t('pluto.post.outlineEmpty')"
          :description="t('pluto.post.outlineEmptyHint')"
          icon="i-lucide-list-tree"
          variant="naked"
        />
      </ScrollAreaViewport>
      <ScrollAreaScrollbar
        orientation="vertical"
        class="flex w-2.5 touch-none p-0.5 select-none"
      >
        <ScrollAreaThumb
          class="relative flex-1 rounded-full bg-(--ui-border-accented) hover:bg-(--ui-text-dimmed)"
        />
      </ScrollAreaScrollbar>
    </ScrollAreaRoot>

    <div
      class="border-default flex shrink-0 items-center gap-2 border-t px-3 py-2"
    >
      <div :aria-label="t('pluto.post.mode')" class="flex gap-1" role="group">
        <UTooltip
          :text="t('pluto.post.visualBlocked')"
          :disabled="!visualBlocked"
          :content="{ side: 'top' }"
        >
          <!-- A disabled button gets no pointer events, so the span carries the tooltip. -->
          <span class="inline-flex">
            <UButton
              :variant="mode === 'visual' ? 'solid' : 'outline'"
              :aria-pressed="mode === 'visual'"
              :disabled="disabled || visualBlocked"
              :label="t('pluto.post.visual')"
              size="xs"
              color="neutral"
              icon="i-lucide-pen-line"
              @click="pick('visual')"
            />
          </span>
        </UTooltip>
        <UButton
          :variant="mode === 'markdown' ? 'solid' : 'outline'"
          :aria-pressed="mode === 'markdown'"
          :disabled="disabled"
          :label="t('pluto.post.markdown')"
          size="xs"
          color="neutral"
          icon="i-lucide-file-code"
          @click="pick('markdown')"
        />
      </div>
    </div>
  </div>
</template>

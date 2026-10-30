<script setup lang="ts">
import {
  ScrollAreaRoot,
  ScrollAreaScrollbar,
  ScrollAreaThumb,
  ScrollAreaViewport,
} from 'reka-ui'

// The left panel of the post editor: the outline of the post (its headings). A click on
// a heading jumps to it in the editor and in the preview.
const props = defineProps<{
  headings: PlutoMarkdownHeading[]
}>()

const emit = defineEmits<{
  select: [index: number]
}>()

const { t } = usePlutoI18n()

// The smallest level of the post is the left edge, so a post that starts at `##` is not indented.
const baseLevel = computed(() =>
  props.headings.reduce((min, heading) => Math.min(min, heading.level), 6)
)
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
  </div>
</template>

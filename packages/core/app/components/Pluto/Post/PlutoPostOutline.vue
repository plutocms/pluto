<script setup lang="ts">
// The left panel of the post editor: the outline of the post (its headings). A click on
// a heading jumps to it in the editor and in the preview. The shell (header, background, scroll
// area) is `PlutoViewSidePanel`, shared with the panels of other layers.
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
  <PlutoViewSidePanel :title="t('pluto.post.outline')">
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
        <!-- The icon of the heading level (H1 to H6). -->
        <UIcon
          :name="`i-lucide-heading-${heading.level}`"
          class="text-dimmed me-2 size-4 shrink-0"
          aria-hidden="true"
        />
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
  </PlutoViewSidePanel>
</template>

<script setup lang="ts">
// The frame around the blocks in the preview page (`/_pluto/preview`). The
// default is a generic docs-like page: a header with the title and the
// description, and the blocks in the body. A site that wants the real layout
// of its pages overrides this component. Put a component with the same name in
// the app (`app/components/PlutoContentPreview.vue`) and render the default
// slot where the blocks go. The slot must hold the blocks directly: no
// wrapper element, because the prose styles read the first and last child.
//
// `frontmatter` is the front matter of the page being edited: the title, the
// description and the other fields of the form. The preview never fetches.
defineProps<{
  frontmatter: Record<string, unknown>
}>()
</script>

<template>
  <UContainer>
    <UPage>
      <UPageHeader
        v-if="typeof frontmatter.title === 'string' && frontmatter.title"
        :title="frontmatter.title"
        :description="
          typeof frontmatter.description === 'string'
            ? frontmatter.description
            : undefined
        "
      />

      <UPageBody>
        <slot />
      </UPageBody>
    </UPage>
  </UContainer>
</template>

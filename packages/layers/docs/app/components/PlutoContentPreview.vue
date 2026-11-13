<script setup lang="ts">
// The slot holds the blocks with no wrapper: the prose styles read the first and last child.
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

<script setup lang="ts">
// One post: the title, the date, the cover and the body (`PlutoHtml`: the embeds and the content
// components of the site too). A draft shows to a signed-in editor, with a badge.
const route = useRoute()
const { post, draft } = await usePost(() => String(route.params.slug))
</script>

<template>
  <article v-if="post">
    <NuxtLink to="/" class="text-muted hover:text-highlighted text-sm">
      ← All posts
    </NuxtLink>

    <p class="text-muted mt-8 text-sm">
      {{ formatPublishedDate(post) }}
      <UBadge
        v-if="draft"
        label="Draft"
        color="warning"
        variant="subtle"
        size="sm"
        class="ms-2"
      />
    </p>
    <h1 class="text-highlighted mt-1 text-3xl font-semibold">
      {{ post.title }}
    </h1>
    <p v-if="post.excerpt" class="text-muted mt-3 text-lg">
      {{ post.excerpt }}
    </p>

    <PlutoImage
      v-if="post.cover"
      :media="post.cover"
      class="mt-8 h-auto w-full rounded-lg"
    />

    <PlutoHtml :html="post.html" tag="div" class="mt-8" />
  </article>
</template>

<script setup lang="ts">
const { posts, page, pages, pageLink } = await usePosts({ limit: 10 })
</script>

<template>
  <div>
    <h1 class="text-highlighted text-2xl font-semibold">Posts</h1>

    <p v-if="!posts.length" class="text-muted mt-6">
      No posts yet.
      <NuxtLink to="/admin" class="text-primary"
        >Write one in the admin.</NuxtLink
      >
    </p>

    <ul class="mt-6 flex flex-col gap-6">
      <li v-for="post in posts" :key="post.id">
        <NuxtLink :to="`/posts/${post.slug}`" class="group block">
          <p class="text-muted text-sm">{{ formatPublishedDate(post) }}</p>
          <h2
            class="text-highlighted text-lg font-semibold group-hover:underline"
          >
            {{ post.title }}
          </h2>
          <p v-if="post.excerpt" class="text-muted mt-1">{{ post.excerpt }}</p>
        </NuxtLink>
      </li>
    </ul>

    <nav v-if="pages > 1" class="mt-10 flex justify-between text-sm">
      <NuxtLink v-if="page > 1" :to="pageLink(page - 1)">Newer</NuxtLink>
      <span v-else />
      <NuxtLink v-if="page < pages" :to="pageLink(page + 1)">Older</NuxtLink>
    </nav>
  </div>
</template>

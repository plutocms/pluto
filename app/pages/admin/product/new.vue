<script setup lang="ts">
import type { Form } from '~/components/Post.vue'

const form = ref<Form>({
  name: '',
  description: '',
  price: 0,
  product_style: '',
  media: [],
  slug: '',
})
</script>

<template>
  <Post v-model="form" />
</template>

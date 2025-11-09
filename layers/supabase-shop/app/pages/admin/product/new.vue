<script setup lang="ts">
import type { Form } from '~/components/Post.vue'

const form = ref<Form>({
  name: '',
  description: '',
  price: 0,
  category: null,
  media: [],
  slug: '',
  availability: null,
  is_custom: false,
  stock_quantity: null,
})
</script>

<template>
  <Post v-model="form" />
</template>

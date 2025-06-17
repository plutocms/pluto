<script setup lang="ts">
import type { Form } from '#layers/pluto/app/components/Post.vue'

const route = useRoute('admin-product-edit-id')

const { data: product } = await useFetch(
  `/api/product/get/${route.params.id}`,
  {
    key: `/api/product/get/${route.params.id}`,
    transform: (res) => res?.data,
  }
)

useHead({
  title: `Editing "${product.value?.name}"`,
})

const form = ref<Form>()

onMounted(() => {
  form.value = product.value
    ? { ...product.value, product_style: product.value.product_style ?? '' }
    : undefined
})
</script>

<template>
  <div>
    <Post v-model="form" :product-id="product?.id" />
  </div>
</template>

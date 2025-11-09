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
  if (product.value) {
    const media = product.value.media.map((item) => ({
      ...item,
      is_saved: true,
    }))

    // Move all .glb media to the end
    const glbMedia = media.filter((item) =>
      item.name?.toLowerCase().endsWith('.glb')
    )

    const otherMedia = media.filter(
      (item) => !item.name?.toLowerCase().endsWith('.glb')
    )

    form.value = {
      ...product.value,
      category: product.value.category,
      media: [...otherMedia, ...glbMedia],
      availability: product.value.availability,
    }
  } else {
    form.value = undefined
  }
})
</script>

<template>
  <div>
    <Post v-model="form" :product-id="product?.id" />
  </div>
</template>

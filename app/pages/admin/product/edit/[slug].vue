<template>
  <div>
    <div class="bg-white/15">
      <input
        v-if="product"
        v-model="form.name"
        v-autofocus
        placeholder="No Title"
        type="text"
        class="h-full w-full px-6 py-8 text-4xl outline-0"
      />
    </div>

    <pre>{{ product }}</pre>
  </div>
</template>

<script setup lang="ts">
  const route = useRoute('admin-product-edit-slug')

  const { data: product } = await useFetch(
    `/api/product/edit/${route.params.slug}`,
    {
      transform: res => res?.data,
    }
  )

  useHead({
    title: `Editing "${product.value?.name}"`,
  })

  interface Form {
    name: string
    slug: string
    description: string
    price: number
    productStyles: string[]
  }

  const form = ref<Form>({
    name: product.value?.name || '',
    slug: '',
    description: '',
    price: 0,
    productStyles: [],
  })
</script>

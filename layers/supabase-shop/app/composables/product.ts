type Product = Omit<
  Database['public']['Tables']['products']['Row'],
  'availability'
>
type Media = Database['public']['Tables']['media']['Row']
type Availability = Database['public']['Tables']['availability']['Row']

export interface ProductItem extends Product {
  media: Media[]
  availability: Availability | null
}

export async function useProduct(productId?: number | null | undefined) {
  const product = ref<ProductItem | null>(null)

  if (productId) {
    const productData = await $fetch<{ data: ProductItem | null }>(
      `/api/product/get/${productId}`
    )

    product.value = productData.data || null
  }

  return { product }
}

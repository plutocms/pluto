type Product = Omit<
  Database['public']['Tables']['products']['Row'],
  'availability' | 'category'
>
type Media = Database['public']['Tables']['media']['Row']
type Availability = Database['public']['Tables']['availability']['Row']
type Category = Database['public']['Tables']['categories']['Row']

export interface ProductItem extends Product {
  media: Media[]
  availability: Availability
  category: Category
}

export interface ProductData {
  data: ProductItem[]
}

export async function useProduct(productId?: number | null | undefined) {
  const list = ref<ProductData | null>(null)

  if (!productId) {
    const productsData = await $fetch<ProductData>(`/api/product/list`)

    list.value = productsData || null
  }

  const product = ref<ProductItem | null>(null)

  if (productId) {
    const productData = await $fetch<{ data: ProductItem | null }>(
      `/api/product/get/${productId}`
    )

    product.value = productData.data || null
  }

  return { list, product }
}

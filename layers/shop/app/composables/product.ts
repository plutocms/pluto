export async function useProduct(productId: number | null | undefined) {
  if (!productId) {
    throw new Error('No product ID provided')
  }

  type Product = Database['public']['Tables']['products']['Row']
  type Media = Database['public']['Tables']['media']['Row']
  type Availability = Database['public']['Tables']['availability']['Row']

  interface ProductData {
    data: Product & { media: Media[] } & { availability: Availability | null }
  }

  const product = ref<ProductData['data'] | null>(null)

  const productData = await $fetch<ProductData>(`/api/product/get/${productId}`)

  product.value = productData.data || null

  return { product }
}

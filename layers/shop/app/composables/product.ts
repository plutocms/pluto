export async function useProduct(productId: number) {
  const response = await useFetch(`/api/product/get/${productId}`, {
    transform: (res) => res?.data,
  })

  return response
}

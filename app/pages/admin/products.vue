<template>
  <div>
    <Modal v-model="isDeleteProductModalOpen">
      <ModalHeader @close="closeRemoveProductModal">Remove product</ModalHeader>

      <ModalContent>
        <p>Do you really want to remove this item?</p>
      </ModalContent>

      <ModalFooter>
        <div class="flex items-center gap-4">
          <UButton
            size="xl"
            icon="lucide:x"
            variant="ghost"
            color="neutral"
            @click="closeRemoveProductModal"
          >
            Cancel
          </UButton>

          <UButton
            size="xl"
            icon="lucide:trash"
            color="error"
            @click="deleteProduct(currentProductId)"
          >
            Remove
          </UButton>
        </div>
      </ModalFooter>
    </Modal>

    <div class="flex flex-col gap-y-4 p-4">
      <div class="flex justify-between">
        <h1 class="text-3xl">All products</h1>

        <UButton icon="lucide:plus" as="NuxtLink" to="/admin/product/new">
          Add product
        </UButton>
      </div>

      <div class="rounded-2xl bg-black/20">
        <UTable ref="table" :data="products?.data" :columns="columns" />
      </div>
    </div>
  </div>
</template>

<script setup lang="tsx">
  import type { TableColumn } from '@nuxt/ui'
  import type { Database } from '~~/types/supabase'
  import { UButton, UIcon, ULink } from '#components'

  type FilteredData = Database['public']['Tables']['products']['Row']

  useHead({
    title: 'All products',
  })

  const { data: products, refresh: refreshProducts } = await useFetch(
    '/api/product/list',
    {
      key: '/api/product/list',
    }
  )

  const columns = ref<TableColumn<FilteredData>[]>([
    {
      accessorKey: 'id',
      header: '#',
    },
    {
      accessorKey: 'name',
      header: 'Name',
      cell: ({ row }) => (
        <ULink to={`/admin/product/edit/${row.getValue('slug')}`}>
          {row.getValue('name')}
        </ULink>
      ),
    },
    {
      accessorKey: 'price',
      header: 'Price',
      cell: ({ row }) =>
        formatCurrency(row.getValue('price'), {
          currency: 'BRL',
          spaceBetween: true,
        }),
    },
    {
      accessorKey: 'product_style',
      header: 'Style',
    },
    {
      accessorKey: 'slug',
      header: 'Slug',
    },
    {
      accessorKey: 'created_at',
      header: 'Created at',
      cell: ({ row }) => new Date(row.getValue('created_at')).toLocaleString(),
    },
    {
      header: 'Actions',
      cell: ({ row }) => (
        <UButton
          variant="ghost"
          color="error"
          onClick={() => openRemoveProductModal(row.getValue('id'))}
        >
          <UIcon name="lucide:trash" />
        </UButton>
      ),
    },
  ])

  const currentProductId = ref<number | null>(null)
  const isDeleteProductModalOpen = ref<boolean>(false)

  function openRemoveProductModal(productId: number | null) {
    if (!productId) return

    currentProductId.value = productId

    isDeleteProductModalOpen.value = true
  }

  function closeRemoveProductModal() {
    currentProductId.value = null

    isDeleteProductModalOpen.value = false
  }

  async function deleteProduct(productId: number | null) {
    if (!productId) return

    try {
      await $fetch(`/api/product/delete/${productId}`, {
        method: 'DELETE',
      })

      refreshProducts()

      closeRemoveProductModal()
    } catch (error) {
      console.error(error)
    }
  }
</script>

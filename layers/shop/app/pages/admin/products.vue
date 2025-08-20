<script setup lang="tsx">
import type { Database } from '#shared/types/supabase'
import type { TableColumn } from '@nuxt/ui'
import { NuxtLink, UButton, ULink } from '#components'

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
      <div class="flex flex-col gap-y-1">
        <div>
          <ULink to={`/admin/product/edit/${row.getValue('id')}`}>
            {row.getValue('name')}
          </ULink>
        </div>

        <div class="opacity-0 group-hover:opacity-100">
          <div class="flex gap-x-3">
            <NuxtLink
              to={`/admin/product/edit/${row.getValue('id')}`}
              class="cursor-pointer px-0 py-0.5 text-blue-300 hover:underline"
            >
              Edit
            </NuxtLink>

            <a
              class="cursor-pointer px-0 py-0.5 text-red-400 hover:underline"
              onClick={(event: Event) => {
                event.preventDefault()
                openRemoveProductModal(row.getValue('id'))
              }}
            >
              Remove
            </a>
          </div>
        </div>
      </div>
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
])

const currentProductId = ref<number | null>(null)
const isDeleteProductModalOpen = ref<boolean>(false)

function openRemoveProductModal(productId: number | null) {
  if (!productId) {
    return
  }

  currentProductId.value = productId

  isDeleteProductModalOpen.value = true
}

function closeRemoveProductModal() {
  currentProductId.value = null

  isDeleteProductModalOpen.value = false
}

async function deleteProduct(productId: number | null) {
  if (!productId) {
    return
  }

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

<template>
  <div>
    <Modal v-model="isDeleteProductModalOpen" :custom-size="680">
      <ModalHeader @close="closeRemoveProductModal">Remove product</ModalHeader>

      <ModalContent>
        <p>Do you really want to remove this item?</p>
      </ModalContent>

      <ModalFooter>
        <div class="flex items-center gap-4">
          <UButton
            icon="lucide:x"
            variant="ghost"
            color="neutral"
            @click="closeRemoveProductModal"
          >
            Cancel
          </UButton>

          <UButton
            icon="lucide:trash"
            color="error"
            @click="deleteProduct(currentProductId)"
          >
            Remove
          </UButton>
        </div>
      </ModalFooter>
    </Modal>

    <AdminView>
      <div class="flex justify-between">
        <h1 class="text-4xl font-bold">All products</h1>

        <UButton icon="lucide:plus" as="NuxtLink" to="/admin/product/new">
          Add product
        </UButton>
      </div>

      <UCard :ui="{ body: 'sm:p-0 p-0' }">
        <UTable
          :data="products?.data"
          :columns="columns"
          :meta="{
            class: {
              tr: 'group',
              // td: 'py-1!',
            },
          }"
        />
      </UCard>
    </AdminView>
  </div>
</template>

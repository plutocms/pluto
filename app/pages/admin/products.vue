<template>
  <div class="flex flex-col gap-y-4 p-4">
    <div class="flex justify-between">
      <h1 class="text-3xl">All products</h1>

      <UButton icon="lucide:plus">Add product</UButton>
    </div>

    <div class="rounded-2xl bg-black/20">
      <UTable ref="table" :data="products?.data" :columns="columns" />
    </div>
  </div>
</template>

<script setup lang="tsx">
  import type { TableColumn } from '@nuxt/ui'
  import type { Database } from '~~/types/supabase'
  import { ULink } from '#components'

  type FilteredData = Database['public']['Tables']['products']['Row']

  useHead({
    title: 'All products',
  })

  const { data: products } = await useFetch('/api/products')

  const columns = ref<TableColumn<FilteredData>[]>([
    {
      accessorKey: 'id',
      header: '#',
    },
    {
      accessorKey: 'name',
      header: 'Name',
      cell: ({ row }) => (
        <ULink to={`/admin/product/${row.getValue('slug')}/edit`}>
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
      accessorKey: 'product_styles',
      header: 'Styles',
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
</script>

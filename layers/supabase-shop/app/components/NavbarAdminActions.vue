<script setup lang="ts">
const route = useRoute('admin-product-edit-id')

const items = computed<NavbarAdminActionButtonProps[]>(() => [
  {
    label: 'Add product',
    icon: 'lucide:plus',
    to: '/admin/product/new',
    show: !route.path.startsWith('/admin/product/new'),
  },

  {
    label: 'Edit product',
    icon: 'lucide:pen-line',
    to: `/admin/product/edit/${route.params.id}`,
    show: route.path.startsWith('/product/'),
  },
])
</script>

<template>
  <template v-for="item in items" :key="item.label">
    <NavbarAdminActionButton
      :label="item.label"
      :icon="item.icon"
      :to="item.to"
      :show="item.show"
    />
  </template>
</template>

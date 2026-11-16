<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'

const { items } = usePlutoMenu('main')

function toNavigation(list: PlutoMenuItem[]): NavigationMenuItem[] {
  return list.map((item) => ({
    label: item.label,
    to: item.to || undefined,
    target: item.target,
    children: item.children.length ? toNavigation(item.children) : undefined,
  }))
}

const links = computed<NavigationMenuItem[]>(() =>
  items.value.length
    ? toNavigation(items.value)
    : [
        { label: 'Posts', to: '/' },
        { label: 'Admin', to: '/admin' },
      ]
)
</script>

<template>
  <UNavigationMenu :items="links" variant="link" class="text-sm" />
</template>

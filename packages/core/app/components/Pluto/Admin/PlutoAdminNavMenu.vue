<script setup lang="ts">
// The admin sidebar menu (UNavigationMenu) with a "+" button at the right end of
// each content type item (`newTo` of the menu item). See PlutoAdminNavNew for
// why the button is not inside the item link. The `item` and `childItem` are
// `relative`, so the button can sit on the row.
//
// The `item-trailing` slot replaces the default trailing content, so this
// component draws the chevron of a group again, with the classes of Nuxt UI.
defineProps<{
  collapsed?: boolean
}>()

const appConfig = useAppConfig()
</script>

<template>
  <UNavigationMenu
    :collapsed="collapsed"
    :ui="{
      item: 'relative',
      childItem: 'relative',
      link: 'gap-x-2.5 py-2',
      linkLeadingIcon: 'size-4.5',
    }"
  >
    <template #item-trailing="{ item, active, ui }">
      <PlutoAdminNavNew
        v-if="item.newTo && !collapsed"
        :label="item.newLabel ?? ''"
        :to="item.newTo"
        :chevron="Boolean(item.children?.length)"
      />
      <UIcon
        v-if="item.children?.length"
        :name="item.trailingIcon || appConfig.ui.icons.chevronDown"
        :class="ui.linkTrailingIcon({ active })"
        data-slot="linkTrailingIcon"
      />
    </template>
  </UNavigationMenu>
</template>

<script setup lang="ts">
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
      link: 'min-h-9 gap-x-2.5 px-2.5 py-2',
      linkLeadingIcon: 'size-4.5',
      content: collapsed ? 'min-w-40' : undefined,
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

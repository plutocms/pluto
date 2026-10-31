<script setup lang="ts">
// The admin sidebar menu (UNavigationMenu) with a "+" at the right end of each
// content type item. The "+" shows on hover and on keyboard focus of the item,
// and goes to the new page of the type (`newTo` of the menu item).
//
// A menu item is a link (or an accordion button), and a link cannot hold
// another link or button: that is invalid HTML. So the "+" is a plain,
// `aria-hidden` <span> in the `item-trailing` slot, not a control. Its click
// handler stops the click, so the item does not navigate, and calls
// `navigateTo`. A keyboard user focuses the item and presses Shift+Enter, which
// reads the new path of the "+" in the focused item. The command palette and
// the "New" menu of the admin bar also reach every new page.
//
// The slot replaces the default trailing content, so this component draws the
// chevron of a group again, with the classes of Nuxt UI.
defineProps<{
  collapsed?: boolean
}>()

const appConfig = useAppConfig()

function create(event: Event, to: string | undefined) {
  if (!to) {
    return
  }
  event.preventDefault()
  event.stopPropagation()
  navigateTo(to)
}

function onShiftEnter(event: KeyboardEvent) {
  const target = event.target as HTMLElement | null
  const plus = target?.querySelector<HTMLElement>('[data-pluto-new-to]')
  if (plus?.dataset.plutoNewTo) {
    create(event, plus.dataset.plutoNewTo)
  }
}
</script>

<template>
  <UNavigationMenu
    :collapsed="collapsed"
    @keydown.shift.enter.capture="onShiftEnter"
  >
    <template #item-trailing="{ item, active, ui }">
      <span
        v-if="item.newTo && !collapsed"
        :title="item.newLabel"
        :data-pluto-new-to="item.newTo"
        class="text-dimmed hover:bg-accented hover:text-highlighted grid size-5 place-items-center rounded-sm opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100"
        aria-hidden="true"
        @click="create($event, item.newTo)"
      >
        <UIcon name="i-lucide-plus" class="size-4" />
      </span>
      <UIcon
        v-if="item.children?.length"
        :name="item.trailingIcon || appConfig.ui.icons.chevronDown"
        :class="ui.linkTrailingIcon({ active })"
        data-slot="linkTrailingIcon"
      />
    </template>
  </UNavigationMenu>
</template>

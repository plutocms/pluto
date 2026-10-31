<script setup lang="ts">
// The admin bar buttons of the content types that set `adminBar`, for a user
// with the `write` capability of the type:
// - "New <type>" on every page where the bar shows. With two or more types, one
//   "New" button opens a menu. The types without a group are direct items. A
//   group (`navGroup`) with two or more types is a submenu.
// - "Edit <type>" on a public page that called `usePlutoEditLink`. The admin
//   form has its own View link, so it does not show on /admin.
// Each button is an <li>, because the bar actions sit in a <ul>.
import type { DropdownMenuItem } from '@nuxt/ui'
import { isAdminPath } from '../../../composables/internal/admin-shell'
import { buildNewMenu } from '../../../composables/internal/new-menu'

const route = useRoute()
const { items: contentTypes, byName } = usePlutoContentTypes()
const { can } = usePlutoPermissions()
const { t } = usePlutoI18n()
const texts = usePlutoContentTexts()
const current = usePlutoCurrentContent()
const registry = usePlutoRegistry()
const { tx } = usePlutoI18n()
const portalTarget = usePlutoAdminPortal()

// The New menu also opens on hover, after a short delay, and closes a short
// time after the pointer leaves the button and the menu. A pointer on the portal
// target counts as inside, because the menu and its submenus render there. This
// keeps the move from the button into the menu, and into a submenu, open.
// Touch has no hover: a tap opens the menu as before. Click and keyboard use the
// open state of the dropdown, so they work as before.
const HOVER_OPEN_DELAY = 120
const HOVER_CLOSE_DELAY = 200
const menuOpen = ref(false)
// True while the menu is open because of a hover. A click on the button then
// keeps it open, instead of toggling it closed. The pointer leaving closes it.
let openedByHover = false
// True when the last open was a hover. Then the close does not move the focus
// back to the button: the focus ring would stay on it after the pointer left.
// A menu opened by a click or the keyboard returns the focus, as before.
let skipFocusReturn = false
let openTimer: ReturnType<typeof setTimeout> | undefined
let closeTimer: ReturnType<typeof setTimeout> | undefined
// The time until which a close request is ignored (see onUpdateOpen).
let confirmUntil = 0

function clearTimers() {
  clearTimeout(openTimer)
  clearTimeout(closeTimer)
}

function onHoverEnter(event: PointerEvent) {
  if (event.pointerType === 'touch') {
    return
  }
  clearTimers()
  if (!menuOpen.value) {
    openTimer = setTimeout(() => {
      if (!menuOpen.value) {
        openedByHover = true
        skipFocusReturn = true
        menuOpen.value = true
      }
    }, HOVER_OPEN_DELAY)
  }
}

function onHoverLeave(event: PointerEvent) {
  if (event.pointerType === 'touch') {
    return
  }
  clearTimers()
  if (menuOpen.value) {
    closeTimer = setTimeout(() => {
      menuOpen.value = false
    }, HOVER_CLOSE_DELAY)
  }
}

// The click confirms the menu that the hover opened. The dropdown must not
// toggle it (pointerdown) and must not see the focus leave its content
// (mousedown moves the focus to the button).
function keepsHoverMenu(event: PointerEvent | MouseEvent): boolean {
  return (
    (!('pointerType' in event) || event.pointerType !== 'touch') &&
    menuOpen.value &&
    openedByHover
  )
}

function onTriggerPointerDown(event: PointerEvent) {
  // A click is faster than the hover delay: it decides, not the hover.
  clearTimeout(openTimer)
  if (keepsHoverMenu(event)) {
    confirmUntil = Date.now() + 500
    event.stopPropagation()
  }
}

// The dropdown asks to close on the click that confirms a hover menu (a pointer
// or focus event outside its content). Ignore that request for a moment.

function onUpdateOpen(open: boolean) {
  if (!open && Date.now() < confirmUntil) {
    return
  }
  if (open) {
    skipFocusReturn = false
  }
  menuOpen.value = open
}

function onCloseAutoFocus(event: Event) {
  if (skipFocusReturn) {
    event.preventDefault()
  }
}

function onTriggerMouseDown(event: MouseEvent) {
  if (keepsHoverMenu(event)) {
    event.preventDefault()
  }
}

watch(menuOpen, (open) => {
  if (!open) {
    openedByHover = false
    clearTimers()
  }
})

watch(portalTarget, (el, previous) => {
  previous?.removeEventListener('pointerenter', onHoverEnter)
  previous?.removeEventListener('pointerleave', onHoverLeave)
  el?.addEventListener('pointerenter', onHoverEnter)
  el?.addEventListener('pointerleave', onHoverLeave)
})

onBeforeUnmount(() => {
  clearTimers()
  portalTarget.value?.removeEventListener('pointerenter', onHoverEnter)
  portalTarget.value?.removeEventListener('pointerleave', onHoverLeave)
})

// No capability declared means open to anyone who can reach the admin, like the form.
function canWrite(type: PlutoContentType): boolean {
  return !type.capabilities?.write || can(type.capabilities.write)
}

const newEntries = computed(() =>
  contentTypes.value.filter(
    ({ type }) => contentTypeAdminBar(type).new && canWrite(type)
  )
)

// One type: a "New <type>" button.
const newButton = computed(() => {
  const type = newEntries.value[0]?.type
  return newEntries.value.length === 1 && type
    ? {
        label: texts(type.name).newLabel,
        to: contentTypeNewPath(type),
      }
    : null
})

// Two or more types: one menu (see buildNewMenu). The types without a group are
// direct items, and a group with two or more types is a submenu.
const newMenuItems = computed<DropdownMenuItem[]>(() =>
  newEntries.value.length < 2
    ? []
    : buildNewMenu(newEntries.value, registry.navGroups.list.value, {
        label: (type) => texts(type.name).label,
        groupLabel: (group) => tx(group.label),
        to: contentTypeNewPath,
      })
)

const editButton = computed(() => {
  const item = current.value
  const type = item ? byName(item.type) : undefined
  if (
    !item ||
    !type ||
    isAdminPath(route.path) ||
    !contentTypeAdminBar(type).edit ||
    !canWrite(type)
  ) {
    return null
  }
  return {
    label: t('pluto.content.edit', { label: texts(type.name).label }),
    to: contentTypeEditPath(type, item.id),
  }
})
</script>

<template>
  <PlutoNavbarButton
    v-if="newButton"
    :label="newButton.label"
    :to="newButton.to"
    icon="i-lucide-plus"
  />
  <li
    v-else-if="newMenuItems.length > 0"
    class="h-full shrink-0"
    @pointerenter="onHoverEnter"
    @pointerleave="onHoverLeave"
    @pointerdown.capture="onTriggerPointerDown"
    @mousedown.capture="onTriggerMouseDown"
  >
    <!--
      The portal and the modal flag follow the user menu. See usePlutoAdminPortal.
    -->
    <UDropdownMenu
      :open="menuOpen"
      :items="newMenuItems"
      :content="{ align: 'start', onCloseAutoFocus }"
      :modal="false"
      :portal="portalTarget ?? true"
      :ui="{ content: 'min-w-48' }"
      :arrow="{ width: 14, height: 7 }"
      @update:open="onUpdateOpen"
    >
      <PlutoNavbarHit
        :label="t('pluto.content.newMenu')"
        icon="i-lucide-plus"
        size="sm"
      >
        <span class="hidden lg:inline">{{ t('pluto.content.newMenu') }}</span>
      </PlutoNavbarHit>
    </UDropdownMenu>
  </li>
  <PlutoNavbarButton
    v-if="editButton"
    :label="editButton.label"
    :to="editButton.to"
    icon="i-lucide-pencil"
  />
</template>

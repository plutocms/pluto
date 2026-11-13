<script setup lang="ts">
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

const HOVER_OPEN_DELAY = 120
const HOVER_CLOSE_DELAY = 200
const menuOpen = ref(false)
let openedByHover = false
let skipFocusReturn = false
let openTimer: ReturnType<typeof setTimeout> | undefined
let closeTimer: ReturnType<typeof setTimeout> | undefined
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

// Keep pointerdown and mousedown from the dropdown: it must not toggle or see the focus leave its content.
function keepsHoverMenu(event: PointerEvent | MouseEvent): boolean {
  return (
    (!('pointerType' in event) || event.pointerType !== 'touch') &&
    menuOpen.value &&
    openedByHover
  )
}

function onTriggerPointerDown(event: PointerEvent) {
  clearTimeout(openTimer)
  if (keepsHoverMenu(event)) {
    confirmUntil = Date.now() + 500
    event.stopPropagation()
  }
}

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

function canWrite(type: PlutoContentType): boolean {
  return !type.capabilities?.write || can(type.capabilities.write)
}

const newEntries = computed(() =>
  contentTypes.value.filter(
    ({ type }) => contentTypeAdminBar(type).new && canWrite(type)
  )
)

const newButton = computed(() => {
  const type = newEntries.value[0]?.type
  return newEntries.value.length === 1 && type
    ? {
        label: texts(type.name).newLabel,
        to: contentTypeNewPath(type),
      }
    : null
})

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
    <UDropdownMenu
      :open="menuOpen"
      :items="newMenuItems"
      :content="{ align: 'start', sideOffset: 2, onCloseAutoFocus }"
      :modal="false"
      :portal="portalTarget ?? true"
      :ui="{
        content: 'min-w-48 bg-(--pluto-admin-navbar)',
        arrow: 'fill-(--pluto-admin-navbar)',
      }"
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

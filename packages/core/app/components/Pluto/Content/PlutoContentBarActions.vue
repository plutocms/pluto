<script setup lang="ts">
// The admin bar buttons of the content types that set `adminBar`, for a user
// with the `write` capability of the type:
// - "New <type>" on every page where the bar shows. With two or more types, one
//   "New" button opens a menu with a link for each type. The menu groups the
//   types by `navGroup`: the types without a group come first.
// - "Edit <type>" on a public page that called `usePlutoEditLink`. The admin
//   form has its own View link, so it does not show on /admin.
// Each button is an <li>, because the bar actions sit in a <ul>.
import type { DropdownMenuItem } from '@nuxt/ui'
import { isAdminPath } from '../../../composables/internal/admin-shell'
import { splitByNavGroup } from '../../../composables/internal/nav-groups'

const route = useRoute()
const { items: contentTypes, byName } = usePlutoContentTypes()
const { can } = usePlutoPermissions()
const { t } = usePlutoI18n()
const texts = usePlutoContentTexts()
const current = usePlutoCurrentContent()
const registry = usePlutoRegistry()
const { tx } = usePlutoI18n()
const portalTarget = usePlutoAdminPortal()

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

// Two or more types: one menu. The types without a group come first. Each group
// follows with its label.
const newMenuItems = computed<DropdownMenuItem[][]>(() => {
  if (newEntries.value.length < 2) {
    return []
  }
  const link = ({ type }: PlutoContentTypeEntry): DropdownMenuItem => ({
    label: texts(type.name).label,
    icon: type.icon,
    type: 'link',
    to: contentTypeNewPath(type),
  })
  const { ungrouped, grouped } = splitByNavGroup(
    newEntries.value,
    registry.navGroups.list.value
  )
  return [
    ...(ungrouped.length > 0 ? [ungrouped.map(link)] : []),
    ...grouped.map(({ group, items }) => [
      { type: 'label' as const, label: tx(group.label) },
      ...items.map(link),
    ]),
  ]
})

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
  <li v-else-if="newMenuItems.length > 0" class="h-full shrink-0">
    <!--
      The portal and the modal flag follow the user menu. See usePlutoAdminPortal.
    -->
    <UDropdownMenu
      :items="newMenuItems"
      :modal="false"
      :portal="portalTarget ?? true"
      :ui="{ content: 'min-w-48' }"
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

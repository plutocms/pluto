<script setup lang="ts">
// The admin bar buttons of the content types that set `adminBar`, for a user
// with the `write` capability of the type:
// - "New <type>" on every page where the bar shows.
// - "Edit <type>" on a public page that called `usePlutoEditLink`. The admin
//   form has its own View link, so it does not show on /admin.
// Each button is an <li>, because the bar actions sit in a <ul>.
import { isAdminPath } from '../../../composables/internal/admin-shell'

const route = useRoute()
const { items: contentTypes, byName } = usePlutoContentTypes()
const { can } = usePlutoPermissions()
const { t } = usePlutoI18n()
const texts = usePlutoContentTexts()
const current = usePlutoCurrentContent()

// No capability declared means open to anyone who can reach the admin, like the form.
function canWrite(type: PlutoContentType): boolean {
  return !type.capabilities?.write || can(type.capabilities.write)
}

const newButtons = computed(() =>
  contentTypes.value
    .map((entry) => entry.type)
    .filter((type) => contentTypeAdminBar(type).new && canWrite(type))
    .map((type) => ({
      name: type.name,
      label: texts(type.name).newLabel,
      to: contentTypeNewPath(type),
    }))
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
    v-for="button in newButtons"
    :key="button.name"
    :label="button.label"
    :to="button.to"
    icon="i-lucide-plus"
  />
  <PlutoNavbarButton
    v-if="editButton"
    :label="editButton.label"
    :to="editButton.to"
    icon="i-lucide-pencil"
  />
</template>

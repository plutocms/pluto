<script setup lang="ts">
const route = useRoute()
const typeName = route.params.type as string
// The route is a catch-all, so a nested id (`guide/intro`) arrives as an array of segments.
const id = computed(() => {
  const param = route.params.id
  return Array.isArray(param) ? param.join('/') : String(param ?? '')
})

const { byName } = usePlutoContentTypes()
const { t } = usePlutoI18n()
const type = byName(typeName)
const text = usePlutoContentText(type)

if (!type) {
  throw createError({
    statusCode: 404,
    statusMessage: 'Content type not found.',
    fatal: true,
  })
}

useHead({
  title: () => t('pluto.content.edit', { label: text.label }),
})
</script>

<template>
  <PlutoContentForm :id="id" :key="id" :type="type.name" />
</template>

<script setup lang="ts">
const route = useRoute()
const typeName = route.params.type as string

const { byName } = usePlutoContentTypes()
const type = byName(typeName)
const text = usePlutoContentText(type)

if (!type) {
  throw createError({
    statusCode: 404,
    statusMessage: 'Content type not found.',
    fatal: true,
  })
}

if (type.singleton) {
  await navigateTo(contentTypeBasePath(type), { replace: true })
}

useHead({
  title: () => text.newLabel,
})
</script>

<template>
  <PlutoContentForm :type="type.name" />
</template>

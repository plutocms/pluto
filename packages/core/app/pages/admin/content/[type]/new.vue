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

// A singleton type has one page: its form at the base path.
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

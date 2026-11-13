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

useHead({
  title: () => (type.singleton ? text.label : text.labelPlural),
})
</script>

<template>
  <PlutoContentSingleton v-if="type.singleton" :type="type.name" />

  <PlutoContentList v-else :type="type.name" />
</template>

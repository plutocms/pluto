<script setup lang="ts">
const route = useRoute()
const typeName = route.params.type as string

const { byName } = usePlutoContentTypes()
const type = byName(typeName)

if (!type) {
  throw createError({ statusCode: 404, statusMessage: 'Content type not found.', fatal: true })
}

useHead({
  title: `Edit ${type.label}`,
})
</script>

<template>
  <PlutoContentForm :id="route.params.id as string" :type="type.name" />
</template>

<script setup lang="ts">
const route = useRoute()
const typeName = route.params.type as string

const { byName } = usePlutoContentTypes()
const { t } = usePlutoI18n()
const type = byName(typeName)
const text = usePlutoContentText(type)

if (!type) {
  throw createError({ statusCode: 404, statusMessage: 'Content type not found.', fatal: true })
}

useHead({
  title: () => t('pluto.content.edit', { label: text.label }),
})
</script>

<template>
  <PlutoContentForm :id="route.params.id as string" :key="String(route.params.id)" :type="type.name" />
</template>

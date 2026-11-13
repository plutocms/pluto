<script setup lang="ts">
import { getLanguageName } from '../../../composables/internal/i18n-core'

const AUTOMATIC = '__automatic__'

const { t, locales, preference, setLocale } = usePlutoI18n()

const items = computed(() => [
  { label: t('pluto.settings.language.automatic'), value: AUTOMATIC },
  ...locales.value.map((code) => ({
    label: getLanguageName(code),
    value: code,
  })),
])

const selected = computed(() => preference.value ?? AUTOMATIC)

function onChange(value: string) {
  void setLocale(value === AUTOMATIC ? null : value, { save: false })
}
</script>

<template>
  <USelect
    v-if="locales.length > 1"
    :model-value="selected"
    :items="items"
    :aria-label="t('pluto.settings.language.label')"
    icon="lucide:languages"
    color="neutral"
    variant="ghost"
    size="sm"
    class="w-auto min-w-44"
    @update:model-value="onChange"
  />
</template>

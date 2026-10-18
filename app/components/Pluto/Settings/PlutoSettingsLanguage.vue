<script setup lang="ts">
import { getLanguageName } from '../../../composables/internal/i18n-core'

// The select cannot hold null, so Automatic uses this value. It is not a
// valid locale code, so it never clashes with one.
const AUTOMATIC = '__automatic__'

const { t, locales, preference, setLocale } = usePlutoI18n()
const toast = useToast()

const items = computed(() => [
  { label: t('pluto.settings.language.automatic'), value: AUTOMATIC },
  // Each language is named in its own language, so a user finds it.
  ...locales.value.map((code) => ({ label: getLanguageName(code), value: code })),
])

const selected = computed(() => preference.value ?? AUTOMATIC)

async function onChange(value: string) {
  try {
    await setLocale(value === AUTOMATIC ? null : value)
    toast.add({ title: t('pluto.settings.language.saved'), color: 'success' })
  } catch (error) {
    // The switch stays on this device. Only the save failed.
    toast.add({
      title: t('pluto.settings.language.saveFailed'),
      description: t('pluto.settings.language.saveFailedDescription', {
        reason: error instanceof Error ? error.message : String(error),
      }),
      color: 'error',
    })
  }
}
</script>

<template>
  <UCard>
    <template #header>
      <h2 class="font-semibold">{{ t('pluto.settings.language.cardTitle') }}</h2>
    </template>

    <UFormField :label="t('pluto.settings.language.label')" :description="t('pluto.settings.language.description')">
      <USelect
        :model-value="selected"
        :items="items"
        class="w-full sm:w-64"
        @update:model-value="onChange"
      />
    </UFormField>
  </UCard>
</template>

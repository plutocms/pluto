<script setup lang="ts">
// The admin language select of the auth pages (under PlutoAdminAuthCard). It
// switches the language on this device only: no user is signed in to save it
// for. The next sign-in saves it to the user (syncUserLocale). It hides when
// the admin has one language.
import { getLanguageName } from '../../../composables/internal/i18n-core'

// The select cannot hold null, so Automatic uses this value. It is not a
// valid locale code, so it never clashes with one.
const AUTOMATIC = '__automatic__'

const { t, locales, preference, setLocale } = usePlutoI18n()

const items = computed(() => [
  { label: t('pluto.settings.language.automatic'), value: AUTOMATIC },
  // Each language is named in its own language, so a user finds it.
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

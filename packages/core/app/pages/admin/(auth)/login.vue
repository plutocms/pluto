<script setup lang="ts">
// The core login page. The file path must stay `admin/(auth)/login.vue`: a
// layer that ships the same path overrides this page, and a different path
// would give two /admin/login routes. The frame is PlutoAdminAuthCard. The sign-in
// form comes from the auth driver.
import { safeRedirect } from '../../../composables/internal/admin-shell'

definePageMeta({ layout: 'auth' })

const { t } = usePlutoI18n()
const route = useRoute()

useHead({ title: () => t('pluto.auth.signIn') })

const query = route.query.redirect
const redirect = computed(() =>
  safeRedirect(Array.isArray(query) ? query[0] : query)
)
</script>

<template>
  <PlutoAdminAuthCard :redirect="redirect" />
</template>

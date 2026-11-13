<script setup lang="ts">
import { safeRedirect } from '../../../composables/internal/admin-shell'

// The file path must stay `admin/(auth)/login.vue`: another path gives two /admin/login routes.
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

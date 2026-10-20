<script setup lang="ts">
// Decides if the CMS navbar shows. It shows on /admin/** except the login
// page, and on public pages when a user is signed in. The session loads in
// the browser, so the server HTML of a public page never holds the navbar.
import { usePlutoCmsSession } from '../../../../modules/pluto-cms/runtime/app/composables/pluto-cms-session'

const route = useRoute()
const { loggedIn } = usePlutoCmsSession()

const isAdmin = computed(() => route.path === '/admin' || route.path.startsWith('/admin/'))

const show = computed(() => {
  if (route.path === '/admin/login') {
    return false
  }
  return isAdmin.value || loggedIn.value
})
</script>

<template>
  <PlutoCmsNavbar v-if="show" />
</template>

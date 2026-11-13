<script setup lang="ts"></script>

<template>
  <nav
    class="text-default fixed inset-0 z-50 h-(--pluto-admin-bar-height) shrink-0 bg-(--pluto-admin-navbar)"
    data-pluto-admin-scope
    data-pluto-admin-dark
  >
    <PlutoAdminTheme>
      <slot />
    </PlutoAdminTheme>
  </nav>
</template>

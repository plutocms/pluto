<script setup lang="ts"></script>

<template>
  <!--
    `data-pluto-admin-scope` keeps the admin theme on this bar when it shows
    on the public site for a logged-in admin. The bar is near black in both
    color modes, so `data-pluto-admin-dark` gives it the dark tokens.
    See admin-theme.css.
  -->
  <nav
    class="text-default border-default fixed inset-0 z-50 h-(--pluto-admin-bar-height) shrink-0 border-b bg-(--pluto-admin-navbar)"
    data-pluto-admin-scope
    data-pluto-admin-dark
  >
    <PlutoAdminTheme>
      <slot />
    </PlutoAdminTheme>
  </nav>
</template>

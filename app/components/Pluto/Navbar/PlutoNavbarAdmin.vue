<script setup lang="ts"></script>

<template>
  <!--
    `data-pluto-admin-scope` keeps the admin theme on this bar when it shows
    on the public site for a logged-in admin. See admin-theme.css.
  -->
  <nav
    class="text-default fixed inset-0 z-50 h-(--ui-header-height) shrink-0 border-b border-default bg-(--pluto-admin-navbar)"
    data-pluto-admin-scope
  >
    <slot />
  </nav>
</template>

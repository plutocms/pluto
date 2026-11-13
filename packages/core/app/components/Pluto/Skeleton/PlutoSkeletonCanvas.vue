<script setup lang="ts"></script>

<template>
  <div
    class="flex min-h-0 flex-1 justify-center overflow-hidden p-6 lg:p-10"
    aria-hidden="true"
  >
    <div class="flex w-full max-w-2xl flex-col gap-4">
      <USkeleton class="h-9 w-3/5" />
      <USkeleton class="h-5 w-4/5" />
      <div class="bg-border my-2 h-px w-full" />
      <USkeleton class="h-4 w-full" />
      <USkeleton class="h-4 w-11/12" />
      <USkeleton class="h-4 w-3/4" />
      <USkeleton class="mt-2 aspect-video w-full" />
      <USkeleton class="mt-2 h-6 w-2/5" />
      <USkeleton class="h-4 w-full" />
      <USkeleton class="h-4 w-5/6" />
      <div class="mt-2 grid grid-cols-2 gap-4">
        <USkeleton class="h-24" />
        <USkeleton class="h-24" />
      </div>
    </div>
  </div>
</template>

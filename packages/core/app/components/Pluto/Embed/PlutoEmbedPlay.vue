<script setup lang="ts"></script>

<template>
  <span class="pluto-embed-play" aria-hidden="true">
    <svg viewBox="0 0 68 48" width="68" height="48">
      <path
        d="M66.5 7.7c-.8-2.9-2.5-5.4-5.4-6.2C55.8.1 34 0 34 0S12.2.1 6.9 1.5C4 2.3 2.3 4.8 1.5 7.7.1 13 0 24 0 24s.1 11 1.5 16.3c.8 2.9 2.5 5.4 5.4 6.2C12.2 47.9 34 48 34 48s21.8-.1 27.1-1.5c2.9-.8 4.6-3.3 5.4-6.2C67.9 35 68 24 68 24s-.1-11-1.5-16.3z"
        class="pluto-embed-play__bg"
      />
      <path d="M45 24 27 14v20" fill="#fff" />
    </svg>
  </span>
</template>

<style>
.pluto-embed-play {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}

.pluto-embed-play__bg {
  fill: #212121;
  fill-opacity: 0.8;
  transition: fill 0.15s;
}

[role='button']:hover .pluto-embed-play__bg,
[role='button']:focus-visible .pluto-embed-play__bg {
  fill: #f00;
  fill-opacity: 1;
}
</style>

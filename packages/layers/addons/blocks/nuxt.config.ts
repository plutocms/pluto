import { fileURLToPath } from 'node:url'

export default defineNuxtConfig({
  $meta: {
    name: 'blocks',
  },

  css: [fileURLToPath(new URL('./app/assets/css/blocks.css', import.meta.url))],
})

import { fileURLToPath } from 'node:url'

export default defineNuxtConfig({
  $meta: {
    name: 'forms',
  },

  css: [fileURLToPath(new URL('./app/assets/css/forms.css', import.meta.url))],

  nitro: {
    scheduledTasks: {
      '30 3 * * *': ['pluto:forms:purge'],
    },
  },
})

import tailwindcss from '@tailwindcss/vite'

export default defineNuxtConfig({
  modules: ['reka-ui/nuxt'],

  $meta: {
    name: 'ui',
  },

  vite: {
    plugins: [tailwindcss()],
  },
})

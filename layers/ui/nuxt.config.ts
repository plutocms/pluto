import tailwindcss from '@tailwindcss/vite'

export default defineNuxtConfig({
  extends: ['github:plutocms/utils'],

  modules: ['@nuxt/ui', 'reka-ui/nuxt'],

  $meta: {
    name: 'ui',
  },

  css: ['#layers/ui/app/assets/css/tailwind.css'],

  vite: {
    plugins: [tailwindcss()],
  },

  reka: {
    prefix: 'Reka',
  },
})

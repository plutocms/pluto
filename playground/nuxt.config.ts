export default defineNuxtConfig({
  extends: [
    '@plutocms/core',
    '@plutocms/3d',
    '@plutocms/shop',
    '@plutocms/seo',
    '@plutocms/syntax-lowlight',
  ],

  css: ['~/assets/css/main.css'],

  runtimeConfig: {
    public: {
      websiteName: 'Pluto playground',
    },
  },

  compatibilityDate: '2025-07-15',
})

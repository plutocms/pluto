export default defineNuxtConfig({
  modules: ['@nuxtjs/supabase'],

  $meta: {
    name: 'supabase',
  },

  ignore: ['./scripts/**', './supabase/**'],

  supabase: {
    cookiePrefix: 'access_token',

    redirectOptions: {
      login: '/admin/login',
      callback: '/auth/confirm',
      include: ['/admin/signup'],
      saveRedirectToCookie: false,
    },
  },
})

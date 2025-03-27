export default defineNuxtPlugin(app => {
  app.vueApp.directive('autofocus', {
    mounted: el => el.focus(),
  })
})

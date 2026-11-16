export default defineNuxtPlugin(() => {
  const appConfig = useAppConfig()

  useHead({
    style: [
      {
        key: 'pluto-blocks-theme',
        innerHTML: () => blocksThemeCss(appConfig.plutoBlocksTheme),
      },
    ],
  })
})

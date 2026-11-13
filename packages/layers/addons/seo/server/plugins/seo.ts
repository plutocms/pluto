export default defineNitroPlugin(() => {
  extendContentTypes(
    plutoSeoTypeExtension(useAppConfig().plutoSeo as PlutoSeoConfig)
  )
})

// Adds the SEO fields to the content types of `plutoSeo.types` on the server, so the generic
// routes, the public API and the static index all see them. The settings are in the app config.
// The extension applies to a type that registers later too, so the order of the plugins does not matter.
export default defineNitroPlugin(() => {
  extendContentTypes(
    plutoSeoTypeExtension(useAppConfig().plutoSeo as PlutoSeoConfig)
  )
})

import type { PlutoDocsTypeOptions } from '../../modules/pluto-docs/options'

export default defineNitroPlugin(() => {
  const config = useRuntimeConfig().public.plutoDocs as
    | {
        types: PlutoDocsTypeOptions[]
        render?: string
      }
    | undefined
  if (!config) {
    return
  }
  for (const entry of config.types) {
    registerContentType(
      createDocsType({
        ...entry,
        liveOnSave: config.render === 'hybrid' || config.render === 'runtime',
      })
    )
  }
})

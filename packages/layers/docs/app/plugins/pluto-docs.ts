import type { PlutoDocsTypeOptions } from '../../modules/pluto-docs/options'

export default defineNuxtPlugin(() => {
  const blockPresets = Object.values(BLOCK_PRESETS).map((definition) => ({
    id: definition.name,
    definition,
  }))

  const config = useRuntimeConfig().public.plutoDocs as unknown as
    | {
        types: PlutoDocsTypeOptions[]
        render?: string
      }
    | undefined
  if (!config) {
    definePlutoExtension({ id: 'docs', blockPresets })
    return
  }

  const types = config.types.map((entry) =>
    createDocsType({
      ...entry,
      liveOnSave: config.render === 'hybrid' || config.render === 'runtime',
    })
  )

  definePlutoExtension({
    id: 'docs',
    contentTypes: types.map((type) => ({ id: type.name, type })),
    capabilities: [
      {
        id: 'docs-write',
        key: DOCS_CAPABILITIES.write,
        label: 'docs.capabilities.write',
      },
      {
        id: 'docs-delete',
        key: DOCS_CAPABILITIES.delete,
        label: 'docs.capabilities.delete',
      },
    ],
    blockPresets,
  })
})

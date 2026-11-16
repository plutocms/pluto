import { defineNuxtModule } from '@nuxt/kit'

export interface PlutoAreasOptions {
  /**
   * Register the area type: an area has a handle (`footer`) and a block body. The backend stores
   * it: a file in the Git CMS, a row of `areas` in Supabase. Default `false`.
   */
  enabled?: boolean
}

export default defineNuxtModule<PlutoAreasOptions>({
  meta: { name: 'pluto-areas', configKey: 'plutoAreas' },
  defaults: { enabled: false },
  setup(options, nuxt) {
    nuxt.options.runtimeConfig.public.plutoAreas = {
      enabled: options.enabled === true,
    }
  },
})

import { defineNuxtModule } from '@nuxt/kit'

export interface PlutoPagesOptions {
  /**
   * Register the page type: pages with a block body and a nested path (`about/team`). The backend
   * stores them: a file in the Git CMS, a row of `pages` in Supabase. Default `false`.
   */
  enabled?: boolean
}

export default defineNuxtModule<PlutoPagesOptions>({
  meta: { name: 'pluto-pages', configKey: 'plutoPages' },
  defaults: { enabled: false },
  setup(options, nuxt) {
    nuxt.options.runtimeConfig.public.plutoPages = {
      enabled: options.enabled === true,
    }
  },
})

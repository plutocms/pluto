import { defineNuxtModule } from '@nuxt/kit'

export interface PlutoMenusOptions {
  /**
   * Register the menu type: a menu has a handle (`main`) and a body of `menu-item` blocks. The
   * backend stores it: a file in the Git CMS, a row of `menus` in Supabase. Default `false`.
   */
  enabled?: boolean
}

export default defineNuxtModule<PlutoMenusOptions>({
  meta: { name: 'pluto-menus', configKey: 'plutoMenus' },
  defaults: { enabled: false },
  setup(options, nuxt) {
    nuxt.options.runtimeConfig.public.plutoMenus = {
      enabled: options.enabled === true,
    }
  },
})

import { join } from 'node:path'
import { defineNuxtModule } from '@nuxt/kit'

export interface PlutoFormsOptions {
  /**
   * The name of the Nitro storage mount that keeps the submissions (a `nitro.storage` entry:
   * Redis, Upstash, Vercel KV, Cloudflare KV, a folder...). In development, with no name, the
   * layer uses the folder `.data/pluto-forms`. In production, with no name and no store from a
   * backend layer, the submit route answers 503.
   */
  storage?: string
  /** The least time between the render of a form and its submission. Default 3 seconds. */
  minFillSeconds?: number
  /** The submissions that one IP can send to a form in one minute. Default 5. */
  rateLimit?: number
}

const DEV_MOUNT = 'pluto-forms'

// The secrets have empty defaults, so `NUXT_PLUTO_FORMS_*` variables set them when the server runs.
export default defineNuxtModule<PlutoFormsOptions>({
  meta: { name: 'pluto-forms', configKey: 'plutoForms' },
  defaults: { storage: '', minFillSeconds: 3, rateLimit: 5 },
  setup(options, nuxt) {
    nuxt.options.runtimeConfig.plutoForms = {
      storage: options.storage ?? '',
      secret: '',
      turnstileSiteKey: '',
      turnstileSecret: '',
      minFillSeconds: options.minFillSeconds ?? 3,
      rateLimit: options.rateLimit ?? 5,
      ...(nuxt.options.runtimeConfig.plutoForms as object | undefined),
    }
    nuxt.options.runtimeConfig.public.plutoForms = { enabled: true }

    nuxt.hook('nitro:config', (nitroConfig) => {
      if (!nuxt.options.dev || options.storage) {
        return
      }
      nitroConfig.devStorage ||= {}
      nitroConfig.devStorage[DEV_MOUNT] ||= {
        driver: 'fs',
        base: join(nuxt.options.rootDir, '.data', DEV_MOUNT),
      }
    })
  },
})

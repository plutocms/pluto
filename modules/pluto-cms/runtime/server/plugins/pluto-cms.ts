import { defineNitroPlugin } from 'nitropack/runtime'
import { createCmsCache } from '../utils/cms-cache'
import { createNitroCacheBackend } from '../utils/cms-cache-nitro'
import { getCmsConfig } from '../utils/cms-config'
import { registerCmsContent } from '../utils/cms-setup'

/**
 * Nitro plugin. The module adds it only when the CMS is on. It picks the
 * store and registers the post type and the Markdown adapter.
 */
export default defineNitroPlugin(() => {
  const config = getCmsConfig()
  const cache = createCmsCache({
    headTtl: config.headTtl,
    backend: createNitroCacheBackend(config.cacheStorage),
  })
  registerCmsContent(config, cache)
})

import { defineNitroPlugin } from 'nitropack/runtime'
import { createGithubCache } from '../utils/github-cache'
import { createNitroCacheBackend } from '../utils/github-cache-nitro'
import { getGithubConfig } from '../utils/github-config'
import { registerGithubContent } from '../utils/github-setup'

/**
 * Nitro plugin. The module adds it only when the CMS is on. It picks the
 * store and registers the post type and the Markdown adapter.
 */
export default defineNitroPlugin(() => {
  const config = getGithubConfig()
  const cache = createGithubCache({
    headTtl: config.headTtl,
    backend: createNitroCacheBackend(config.cacheStorage),
  })
  registerGithubContent(config, cache)
})

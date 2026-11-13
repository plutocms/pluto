import { defineNitroPlugin, useStorage } from 'nitropack/runtime'
import { SNAPSHOT_ASSETS } from '../../shared/snapshot'
import { createGithubCache } from '../utils/github-cache'
import { createNitroCacheBackend } from '../utils/github-cache-nitro'
import { getGithubConfig } from '../utils/github-config'
import { registerGithubContent } from '../utils/github-setup'

export default defineNitroPlugin(() => {
  const config = getGithubConfig()
  const cache = createGithubCache({
    headTtl: config.headTtl,
    backend: createNitroCacheBackend(config.cacheStorage),
  })
  registerGithubContent(config, cache, () => loadBuildSnapshot(config.dir))
})

async function loadBuildSnapshot(dir: string): Promise<Record<string, string>> {
  const files: Record<string, string> = {}
  try {
    const storage = useStorage(`assets:${SNAPSHOT_ASSETS}`)
    for (const key of await storage.getKeys()) {
      if (!key.endsWith('.md')) {
        continue
      }
      const value = await storage.getItemRaw(key)
      const text =
        typeof value === 'string'
          ? value
          : value instanceof Uint8Array
            ? new TextDecoder().decode(value)
            : null
      if (text !== null) {
        files[`${dir}/${key.replaceAll(':', '/')}`] = text
      }
    }
  } catch (error) {
    console.warn('[pluto-github] Could not read the build snapshot.', error)
  }
  return files
}

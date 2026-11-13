import type { GithubCacheBackend } from './github-cache'
import { useStorage } from 'nitropack/runtime'

export function createNitroCacheBackend(mount: string): GithubCacheBackend {
  const storage = useStorage(mount)
  return {
    get: async <T>(key: string) => (await storage.getItem<T>(key)) ?? undefined,
    set: async (key, value) => {
      await storage.setItem(key, value as never)
    },
    remove: async (key) => {
      await storage.removeItem(key)
    },
  }
}

export interface GithubCacheBackend {
  get: <T>(key: string) => Promise<T | undefined>
  set: (key: string, value: unknown) => Promise<void>
  remove: (key: string) => Promise<void>
}

/** The default backend: a plain Map. Tests use it. */
export function createMemoryCacheBackend(): GithubCacheBackend {
  const map = new Map<string, unknown>()
  return {
    get: async <T>(key: string) => map.get(key) as T | undefined,
    set: async (key, value) => {
      map.set(key, value)
    },
    remove: async (key) => {
      map.delete(key)
    },
  }
}

export interface GithubHeadEntry {
  oid: string
  etag?: string
  /** Epoch ms of the last check against GitHub. */
  at: number
}

export interface GithubCacheOptions {
  backend?: GithubCacheBackend
  /** Seconds the head stays fresh. */
  headTtl: number
  now?: () => number
  /** Key prefix, so several repos can share one backend. */
  prefix?: string
}

export interface GithubCache {
  getHead: () => Promise<GithubHeadEntry | undefined>
  isHeadFresh: (entry: GithubHeadEntry) => boolean
  setHead: (oid: string, etag?: string) => Promise<void>
  getIndex: <T>(dir: string, headOid: string) => Promise<T | undefined>
  setIndex: (dir: string, headOid: string, value: unknown) => Promise<void>
  /** Parsed results by blob id. A blob id never changes, so no TTL. */
  getBlob: <T>(oid: string) => Promise<T | undefined>
  setBlob: (oid: string, value: unknown) => Promise<void>
  /** Runs `loader` once for all concurrent calls with the same key. */
  singleFlight: <T>(key: string, loader: () => Promise<T>) => Promise<T>
}

export function createGithubCache(options: GithubCacheOptions): GithubCache {
  const backend = options.backend ?? createMemoryCacheBackend()
  const now = options.now ?? Date.now
  const prefix = options.prefix ?? 'pluto-github'
  const inFlight = new Map<string, Promise<unknown>>()

  return {
    getHead: () => backend.get<GithubHeadEntry>(`${prefix}:head`),
    isHeadFresh: (entry) => now() - entry.at < options.headTtl * 1000,
    setHead: (oid, etag) =>
      backend.set(`${prefix}:head`, {
        oid,
        etag,
        at: now(),
      } satisfies GithubHeadEntry),
    getIndex: (dir, headOid) =>
      backend.get(`${prefix}:index:${dir}@${headOid}`),
    setIndex: (dir, headOid, value) =>
      backend.set(`${prefix}:index:${dir}@${headOid}`, value),
    getBlob: (oid) => backend.get(`${prefix}:blob:${oid}`),
    setBlob: (oid, value) => backend.set(`${prefix}:blob:${oid}`, value),
    singleFlight<T>(key: string, loader: () => Promise<T>): Promise<T> {
      const existing = inFlight.get(key)
      if (existing) {
        return existing as Promise<T>
      }
      const promise = loader().finally(() => {
        inFlight.delete(key)
      })
      inFlight.set(key, promise)
      return promise
    },
  }
}

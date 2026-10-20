export interface CmsCacheBackend {
  get: <T>(key: string) => Promise<T | undefined>
  set: (key: string, value: unknown) => Promise<void>
  remove: (key: string) => Promise<void>
}

/** The default backend: a plain Map. Tests use it. */
export function createMemoryCacheBackend(): CmsCacheBackend {
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

export interface CmsHeadEntry {
  oid: string
  etag?: string
  /** Epoch ms of the last check against GitHub. */
  at: number
}

export interface CmsCacheOptions {
  backend?: CmsCacheBackend
  /** Seconds the head stays fresh. */
  headTtl: number
  now?: () => number
  /** Key prefix, so several repos can share one backend. */
  prefix?: string
}

export interface CmsCache {
  getHead: () => Promise<CmsHeadEntry | undefined>
  isHeadFresh: (entry: CmsHeadEntry) => boolean
  setHead: (oid: string, etag?: string) => Promise<void>
  getIndex: <T>(dir: string, headOid: string) => Promise<T | undefined>
  setIndex: (dir: string, headOid: string, value: unknown) => Promise<void>
  /** Parsed results by blob id. A blob id never changes, so no TTL. */
  getBlob: <T>(oid: string) => Promise<T | undefined>
  setBlob: (oid: string, value: unknown) => Promise<void>
  /** Runs `loader` once for all concurrent calls with the same key. */
  singleFlight: <T>(key: string, loader: () => Promise<T>) => Promise<T>
}

export function createCmsCache(options: CmsCacheOptions): CmsCache {
  const backend = options.backend ?? createMemoryCacheBackend()
  const now = options.now ?? Date.now
  const prefix = options.prefix ?? 'pluto-cms'
  const inFlight = new Map<string, Promise<unknown>>()

  return {
    getHead: () => backend.get<CmsHeadEntry>(`${prefix}:head`),
    isHeadFresh: (entry) => now() - entry.at < options.headTtl * 1000,
    setHead: (oid, etag) => backend.set(`${prefix}:head`, { oid, etag, at: now() } satisfies CmsHeadEntry),
    getIndex: (dir, headOid) => backend.get(`${prefix}:index:${dir}@${headOid}`),
    setIndex: (dir, headOid, value) => backend.set(`${prefix}:index:${dir}@${headOid}`, value),
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

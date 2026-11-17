import type {
  PlutoFormStore,
  PlutoFormSubmission,
  PlutoFormSubmissionInput,
} from '../../shared/types/forms'
import { randomBytes } from 'node:crypto'

/** The part of a Nitro storage (unstorage) that the store uses. */
export interface PlutoFormsStorage {
  getKeys: (base?: string) => Promise<string[]>
  getItem: (key: string) => Promise<unknown>
  setItem: (key: string, value: unknown) => Promise<void>
  removeItem: (key: string) => Promise<void>
  getMounts?: (
    base?: string,
    options?: { parents?: boolean }
  ) => Array<{ base: string }>
}

const FORM = /^[a-z0-9][a-z0-9-]{0,59}$/

const ID = /^\d{13}-[0-9a-f]{8}$/

let registered: PlutoFormStore | undefined

/**
 * Registers the store of the submissions. A backend layer calls it from a Nitro plugin. The
 * last store wins, and it wins over the storage mount of `plutoForms.storage`.
 * @see https://pluto.vulmix.dev/docs/build/forms
 */
export function registerFormStore(store: PlutoFormStore | undefined): void {
  registered = store
}

export function getRegisteredFormStore(): PlutoFormStore | undefined {
  return registered
}

function idOf(key: string): string {
  return key.split(':').pop() ?? key
}

function isSubmission(value: unknown): value is PlutoFormSubmission {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as PlutoFormSubmission).id === 'string' &&
    typeof (value as PlutoFormSubmission).values === 'object'
  )
}

/**
 * A store on a Nitro storage mount (a file folder, Redis, Upstash, Vercel KV, Cloudflare KV...).
 * A submission is one item with the key `<form>:<id>`. The id starts with the time, so the keys
 * sort by date. Listing reads every key of the form, so use a database store for a big volume.
 */
export function createStorageFormStore(
  storage: PlutoFormsStorage,
  id = 'storage'
): PlutoFormStore {
  async function keys(form: string): Promise<string[]> {
    if (!FORM.test(form)) {
      return []
    }
    const found = await storage.getKeys(form)
    return found.filter((key) => ID.test(idOf(key))).sort().reverse()
  }

  return {
    id,

    async add(input: PlutoFormSubmissionInput) {
      if (!FORM.test(input.form)) {
        throw new Error('The form handle is not valid.')
      }
      const time = input.createdAt ? new Date(input.createdAt) : new Date()
      const submission: PlutoFormSubmission = {
        id: `${String(time.getTime()).padStart(13, '0')}-${randomBytes(4).toString('hex')}`,
        form: input.form,
        createdAt: time.toISOString(),
        values: input.values,
      }
      await storage.setItem(`${input.form}:${submission.id}`, submission)
      return submission
    },

    async list(form, query) {
      const all = await keys(form)
      const page = all.slice(query.offset, query.offset + query.limit)
      const items = await Promise.all(page.map((key) => storage.getItem(key)))
      return { data: items.filter(isSubmission), total: all.length }
    },

    async get(form, submissionId) {
      if (!FORM.test(form) || !ID.test(submissionId)) {
        return null
      }
      const item = await storage.getItem(`${form}:${submissionId}`)
      return isSubmission(item) ? item : null
    },

    async delete(form, submissionId) {
      if (FORM.test(form) && ID.test(submissionId)) {
        await storage.removeItem(`${form}:${submissionId}`)
      }
    },

    async purge(form, olderThan) {
      const cutoff = olderThan.getTime()
      const old = (await keys(form)).filter(
        (key) => Number(idOf(key).slice(0, 13)) < cutoff
      )
      await Promise.all(old.map((key) => storage.removeItem(key)))
      return old.length
    },
  }
}

export interface PlutoFormsStoreChoice {
  store: PlutoFormStore | null
  /** Why there is no store, or where it is. For the setup page and the logs. */
  source: 'registered' | 'storage' | 'dev-fs' | 'none' | 'missing-mount'
  mount?: string
}

/**
 * Picks the store: a registered one, else the Nitro storage mount named by `plutoForms.storage`,
 * else (in development) the `fs` folder `.data/pluto-forms`, else none. A name with no mount is
 * not a store: the default memory storage would lose the submissions.
 */
export function chooseFormStore(options: {
  storageName: string
  dev: boolean
  devMount: string
  storage: PlutoFormsStorage
}): PlutoFormsStoreChoice {
  if (registered) {
    return { store: registered, source: 'registered' }
  }
  const name = options.storageName || (options.dev ? options.devMount : '')
  if (!name) {
    return { store: null, source: 'none' }
  }
  const mounts = options.storage.getMounts?.(`${name}:`, { parents: false })
  if (!mounts || mounts.length === 0) {
    return { store: null, source: 'missing-mount', mount: name }
  }
  return {
    store: createStorageFormStore(
      prefixed(options.storage, name),
      `storage:${name}`
    ),
    source: options.storageName ? 'storage' : 'dev-fs',
    mount: name,
  }
}

function prefixed(storage: PlutoFormsStorage, name: string): PlutoFormsStorage {
  const prefix = `${name}:`
  return {
    getKeys: async (base = '') =>
      (await storage.getKeys(`${prefix}${base}`)).map((key) =>
        key.startsWith(prefix) ? key.slice(prefix.length) : key
      ),
    getItem: (key) => storage.getItem(`${prefix}${key}`),
    setItem: (key, value) => storage.setItem(`${prefix}${key}`, value),
    removeItem: (key) => storage.removeItem(`${prefix}${key}`),
  }
}

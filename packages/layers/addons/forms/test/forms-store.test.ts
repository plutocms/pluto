import { createStorage } from 'unstorage'
import memory from 'unstorage/drivers/memory'
import { afterEach, describe, expect, it } from 'vitest'
import {
  chooseFormStore,
  createStorageFormStore,
  registerFormStore,
} from '../server/utils/forms-store'
import { describeFormStoreContract } from './store-contract'

describeFormStoreContract('the storage store', () =>
  createStorageFormStore(createStorage({ driver: memory() }))
)

describeFormStoreContract('the storage store on a mount', () => {
  const root = createStorage({ driver: memory() })
  root.mount('forms', memory())
  const choice = chooseFormStore({
    storageName: 'forms',
    dev: false,
    devMount: 'pluto-forms',
    storage: root as never,
  })
  return choice.store!
})

describe('the storage store', () => {
  it('refuses a handle that is not safe', async () => {
    const store = createStorageFormStore(createStorage({ driver: memory() }))

    await expect(
      store.add({ form: '../etc', values: {} })
    ).rejects.toThrow()
    expect(await store.list('../etc', { limit: 10, offset: 0 })).toEqual({
      data: [],
      total: 0,
    })
  })
})

describe('chooseFormStore', () => {
  const none = { getKeys: async () => [], getItem: async () => null, setItem: async () => {}, removeItem: async () => {} }

  afterEach(() => {
    registerFormStore(undefined)
  })

  it('has no store in production with no name', () => {
    const choice = chooseFormStore({
      storageName: '',
      dev: false,
      devMount: 'pluto-forms',
      storage: createStorage() as never,
    })

    expect(choice).toEqual({ store: null, source: 'none' })
  })

  it('does not trust a name with no mount', () => {
    const choice = chooseFormStore({
      storageName: 'forms',
      dev: false,
      devMount: 'pluto-forms',
      storage: createStorage() as never,
    })

    expect(choice).toEqual({
      store: null,
      source: 'missing-mount',
      mount: 'forms',
    })
  })

  it('uses the dev mount in development with no name', () => {
    const root = createStorage()
    root.mount('pluto-forms', memory())

    const choice = chooseFormStore({
      storageName: '',
      dev: true,
      devMount: 'pluto-forms',
      storage: root as never,
    })

    expect(choice.source).toBe('dev-fs')
    expect(choice.store).not.toBeNull()
  })

  it('does not use the dev mount in production', () => {
    const root = createStorage()
    root.mount('pluto-forms', memory())

    expect(
      chooseFormStore({
        storageName: '',
        dev: false,
        devMount: 'pluto-forms',
        storage: root as never,
      }).store
    ).toBeNull()
  })

  it('prefers a store that a backend layer registered', () => {
    const registered = createStorageFormStore(none, 'backend')
    registerFormStore(registered)

    const choice = chooseFormStore({
      storageName: 'forms',
      dev: false,
      devMount: 'pluto-forms',
      storage: createStorage() as never,
    })

    expect(choice).toEqual({ store: registered, source: 'registered' })
  })
})

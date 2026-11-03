import type { PlutoGithubStore } from '../modules/pluto-github/runtime/server/store/types'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createMemoryStore } from '../modules/pluto-github/runtime/server/store/memory'
import {
  createSnapshotStore,
  withBuildSnapshot,
} from '../modules/pluto-github/runtime/server/store/snapshot'
import { createGithubCache } from '../modules/pluto-github/runtime/server/utils/github-cache'
import { createContentStore } from '../modules/pluto-github/runtime/server/utils/github-setup'
import { resetTestConfig, testConfig } from './fixtures/github-test-config'

vi.mock(
  '../modules/pluto-github/runtime/server/utils/github-config',
  async () => {
    const { testConfig } = await import('./fixtures/github-test-config')
    return { getGithubConfig: () => testConfig }
  }
)

const POST = `---
title: Hello
status: published
---
Hi there.
`

const files = {
  'content/posts/hello.md': POST,
  'content/posts/draft.md': '---\ntitle: Draft\nstatus: draft\n---\n',
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('the build snapshot store', () => {
  it('lists and reads the files of the build', async () => {
    const store = createSnapshotStore(async () => files)
    const head = await store.head()
    const list = await store.listDir('content/posts', head)
    expect(list.map((file) => file.name)).toEqual(['draft.md', 'hello.md'])
    expect((await store.readFile('content/posts/hello.md', head))?.text).toBe(
      POST
    )
    expect(await store.hasFiles()).toBe(true)
  })

  it('is read only', async () => {
    const store = createSnapshotStore(async () => files)
    await expect(
      store.commit(
        {
          message: 'x',
          expectedHeadOid: await store.head(),
          additions: [],
          deletions: [],
        },
        { token: 't' }
      )
    ).rejects.toMatchObject({ code: 'forbidden' })
  })

  it('loads the files once', async () => {
    const load = vi.fn(async () => files)
    const store = createSnapshotStore(load)
    await store.head()
    await store.listTree('content', await store.head())
    expect(load).toHaveBeenCalledTimes(1)
  })
})

describe('withBuildSnapshot', () => {
  function github(): PlutoGithubStore {
    return createMemoryStore({ 'content/posts/live.md': POST })
  }

  it('sends an anonymous read to the snapshot, and a signed-in call to GitHub', async () => {
    const onFallback = vi.fn()
    const store = withBuildSnapshot(
      github(),
      createSnapshotStore(async () => files),
      onFallback
    )
    const anonymous = await store.listDir('content/posts', await store.head())
    expect(anonymous.map((file) => file.name)).toEqual(['draft.md', 'hello.md'])
    expect(onFallback).toHaveBeenCalled()

    const auth = { token: 'user' }
    const signedIn = await store.listDir(
      'content/posts',
      await store.head({ auth }),
      auth
    )
    expect(signedIn.map((file) => file.name)).toEqual(['live.md'])
  })

  it('goes to GitHub when the build bundled nothing', async () => {
    const store = withBuildSnapshot(
      github(),
      createSnapshotStore(async () => ({}))
    )
    const list = await store.listDir('content/posts', await store.head())
    expect(list.map((file) => file.name)).toEqual(['live.md'])
  })
})

describe('createContentStore', () => {
  const cache = () => createGithubCache({ headTtl: 0 })

  it('reads the snapshot for anonymous callers before the App or a read token exists', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const fetch = vi.fn()
    resetTestConfig(undefined, {
      storage: 'github',
      appId: '',
      privateKey: '',
      readToken: '',
      fetch,
    })
    const store = createContentStore(testConfig, cache(), async () => files)
    const list = await store.listDir('content/posts', await store.head())
    expect(list.map((file) => file.name)).toEqual(['draft.md', 'hello.md'])
    expect(fetch).not.toHaveBeenCalled()
  })

  it('reads GitHub once a read token exists', async () => {
    const fetch = vi.fn(async () => ({
      status: 200,
      headers: { get: () => null },
      data: 'f'.repeat(40),
    }))
    resetTestConfig(undefined, {
      storage: 'github',
      readToken: 'pat',
      fetch,
    })
    const store = createContentStore(testConfig, cache(), async () => files)
    await store.head()
    expect(fetch).toHaveBeenCalled()
  })
})

import type { H3Event } from 'h3'
import type { PlutoGithubAccess } from '../modules/pluto-github/runtime/server/adapter'
import type { PlutoMediaUpload } from '../shared/types/media'
import { Buffer } from 'node:buffer'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  createGithubMediaDriver,
  githubMediaContentType,
  githubMediaPath,
} from '../modules/pluto-github/runtime/server/media'
import { createFsStore } from '../modules/pluto-github/runtime/server/store/fs'
import { createGithubStore } from '../modules/pluto-github/runtime/server/store/github'
import { createMemoryStore } from '../modules/pluto-github/runtime/server/store/memory'
import { createGithubCache } from '../modules/pluto-github/runtime/server/utils/github-cache'
import { createFakeGithub } from './fixtures/fake-github'

const event = {} as H3Event
const editor: PlutoGithubAccess = { capabilities: ['*'], auth: { token: 't' } }

function upload(overrides: Partial<PlutoMediaUpload> = {}): PlutoMediaUpload {
  return {
    fileName: 'red-mug-k3j9a.webp',
    name: 'Red Mug.JPG',
    data: new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0xff, 0x10]),
    mimeType: 'image/webp',
    size: 7,
    width: 2400,
    height: 1600,
    alt: 'A red mug',
    createdAt: '2026-10-29T12:00:00.000Z',
    ...overrides,
  }
}

function setup(access: PlutoGithubAccess | null = editor, skipDeploy = false) {
  const store = createMemoryStore()
  const commits: string[] = []
  const commit = store.commit
  store.commit = async (input, auth) => {
    commits.push(input.message)
    return commit(input, auth)
  }
  const driver = createGithubMediaDriver({
    store,
    dir: 'content',
    getAccess: async () => access,
    skipDeploy,
  })
  return { store, driver, commits }
}

describe('github media driver', () => {
  it('commits the file and its record together, and gives the full record', async () => {
    const { store, driver, commits } = setup()
    const record = await driver.upload(event, upload())

    expect(record).toEqual({
      id: 'red-mug-k3j9a',
      url: '/media/2026/10/red-mug-k3j9a.webp',
      name: 'Red Mug.JPG',
      mimeType: 'image/webp',
      size: 7,
      width: 2400,
      height: 1600,
      alt: 'A red mug',
      createdAt: '2026-10-29T12:00:00.000Z',
    })
    expect(commits).toEqual(['media: add red-mug-k3j9a.webp'])
    expect([
      ...(await store.readRaw('public/media/2026/10/red-mug-k3j9a.webp'))!,
    ]).toEqual([0x52, 0x49, 0x46, 0x46, 0, 0xff, 0x10])
    const recordFile = await store.readFile(
      'content/media/red-mug-k3j9a.md',
      ''
    )
    expect(recordFile?.text).toContain('mimeType: image/webp')
    expect(recordFile?.text).toContain(
      'file: public/media/2026/10/red-mug-k3j9a.webp'
    )
  })

  it('lists, searches and gets the records', async () => {
    const { driver } = setup()
    await driver.upload(event, upload())
    await driver.upload(
      event,
      upload({
        fileName: 'mug-model-aaaaa.glb',
        name: 'mug.glb',
        mimeType: 'model/gltf-binary',
        width: null,
        height: null,
        alt: '',
        createdAt: '2026-10-30T00:00:00.000Z',
      })
    )

    const all = await driver.list(event, { limit: 10, offset: 0 })
    expect(all.total).toBe(2)
    expect(all.data.map((record) => record.id)).toEqual([
      'mug-model-aaaaa',
      'red-mug-k3j9a',
    ])
    expect(
      (await driver.list(event, { limit: 10, offset: 0, type: 'image' })).total
    ).toBe(1)
    expect(
      (await driver.list(event, { limit: 10, offset: 0, search: 'red' })).total
    ).toBe(1)
    const [model] = await driver.get(event, ['mug-model-aaaaa', 'gone'])
    expect(model).toMatchObject({ mimeType: 'model/gltf-binary', width: null })
  })

  it('reads for a visitor too: the public API gets records with no caller', async () => {
    const { store } = setup()
    const writer = createGithubMediaDriver({
      store,
      dir: 'content',
      getAccess: async () => editor,
    })
    await writer.upload(event, upload())
    const reader = createGithubMediaDriver({
      store,
      dir: 'content',
      getAccess: async () => null,
    })
    expect(await reader.get(event, ['red-mug-k3j9a'])).toHaveLength(1)
  })

  it('changes the alt text in the record file', async () => {
    const { driver } = setup()
    await driver.upload(event, upload())
    const next = await driver.update(event, 'red-mug-k3j9a', {
      alt: 'A blue mug',
    })
    expect(next.alt).toBe('A blue mug')
    expect((await driver.get(event, ['red-mug-k3j9a']))[0]?.alt).toBe(
      'A blue mug'
    )
  })

  it('deletes the file and the record in one commit', async () => {
    const { store, driver, commits } = setup(editor, true)
    await driver.upload(event, upload())
    await driver.remove(event, 'red-mug-k3j9a')
    expect(commits.at(-1)).toBe('media: delete red-mug-k3j9a [skip ci]')
    expect(
      await store.readRaw('public/media/2026/10/red-mug-k3j9a.webp')
    ).toBeNull()
    expect((await driver.list(event, { limit: 10, offset: 0 })).total).toBe(0)
  })

  it('refuses a bad id with 404, and a missing record with 404', async () => {
    const { driver } = setup()
    await expect(driver.remove(event, '../../secrets')).rejects.toMatchObject({
      statusCode: 404,
    })
    await expect(
      driver.update(event, 'gone', { alt: '' })
    ).rejects.toMatchObject({ statusCode: 404 })
  })

  it('authorize: 401 for a visitor, 403 without the capability, and passes with it', async () => {
    await expect(
      setup(null).driver.authorize(event, 'media:manage')
    ).rejects.toMatchObject({ statusCode: 401 })
    const reader = { capabilities: ['posts:read_drafts'], auth: { token: 't' } }
    await expect(
      setup(reader).driver.authorize(event, 'media:delete')
    ).rejects.toMatchObject({ statusCode: 403 })
    const pusher = { capabilities: ['media:manage'], auth: { token: 't' } }
    await expect(
      setup(pusher).driver.authorize(event, 'media:manage')
    ).resolves.toBeUndefined()
  })
})

describe('the /media/** route helpers', () => {
  it('takes only a media path: year, month, a safe file name', () => {
    expect(githubMediaPath('2026/10/red-mug-k3j9a.webp')).toBe(
      '2026/10/red-mug-k3j9a.webp'
    )
    expect(githubMediaPath('../../.env')).toBeNull()
    expect(githubMediaPath('2026/10/../x.webp')).toBeNull()
    expect(githubMediaPath('2026/10/.hidden')).toBeNull()
    expect(githubMediaPath('x.webp')).toBeNull()
  })

  it('sends the type of the extension, and a download type for others', () => {
    expect(githubMediaContentType('2026/10/a.webp')).toBe('image/webp')
    expect(githubMediaContentType('2026/10/a.glb')).toBe('model/gltf-binary')
    expect(githubMediaContentType('2026/10/a.html')).toBe(
      'application/octet-stream'
    )
  })
})

describe('binary files in the stores', () => {
  let root = ''
  afterEach(async () => {
    if (root) {
      await rm(root, { recursive: true, force: true })
      root = ''
    }
  })

  it('fs: writes the bytes as they are and reads them back', async () => {
    root = await mkdtemp(join(tmpdir(), 'pluto-media-'))
    const store = createFsStore({ root, headDir: 'content' })
    const bytes = new Uint8Array([0, 0xff, 0x80, 0x0a, 0x0d])
    await store.commit(
      {
        expectedHeadOid: await store.head(),
        message: 'media',
        additions: [
          {
            path: 'public/media/a.bin',
            contents: Buffer.from(bytes).toString('base64'),
            encoding: 'base64',
          },
        ],
        deletions: [],
      },
      { token: '' }
    )
    expect([...(await readFile(join(root, 'public/media/a.bin')))]).toEqual([
      ...bytes,
    ])
    expect([...(await store.readRaw('public/media/a.bin'))!]).toEqual([
      ...bytes,
    ])
    expect(await store.readRaw('public/media/none.bin')).toBeNull()
    await expect(store.readRaw('../outside')).rejects.toThrow()
  })

  it('github: sends base64 as it is, and reads the raw file', async () => {
    const github = createFakeGithub({ files: { 'content/posts/a.md': 'A' } })
    const store = createGithubStore({
      repo: github.repo,
      branch: github.branch,
      apiUrl: 'https://api.github.com',
      cache: createGithubCache({ headTtl: 0 }),
      readToken: 'read',
      fetch: github.fetch,
    })
    const bytes = new Uint8Array([0, 0xff, 0x80, 0x0a])
    await store.commit(
      {
        expectedHeadOid: await store.head({
          revalidate: true,
          auth: { token: 't' },
        }),
        message: 'media',
        additions: [
          {
            path: 'public/media/2026/10/a.webp',
            contents: Buffer.from(bytes).toString('base64'),
            encoding: 'base64',
          },
        ],
        deletions: [],
      },
      { token: 't' }
    )
    expect([...(await store.readRaw('public/media/2026/10/a.webp'))!]).toEqual([
      ...bytes,
    ])
    expect(await store.readRaw('public/media/2026/10/none.webp')).toBeNull()
  })
})

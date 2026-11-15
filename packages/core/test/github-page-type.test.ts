import { generateKeyPairSync } from 'node:crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createGithubCache } from '../modules/pluto-github/runtime/server/utils/github-cache'
import { mapRepoPermission } from '../modules/pluto-github/runtime/server/utils/github-oauth'
import { registerGithubContent } from '../modules/pluto-github/runtime/server/utils/github-setup'
import { plutoGithubPageType } from '../modules/pluto-github/runtime/shared/page-type'
import { getContentType } from '../server/utils/pluto-content'
import {
  getPublicContent,
  listPublicContent,
} from '../server/utils/pluto-public-api'
import { createFakeGithub } from './fixtures/fake-github'
import { resetTestConfig } from './fixtures/github-auth-harness'
import { testConfig } from './fixtures/github-test-config'

vi.mock(
  '../modules/pluto-github/runtime/server/utils/github-config',
  async () => {
    const { testConfig } = await import('./fixtures/github-test-config')
    return { getGithubConfig: () => testConfig }
  }
)

vi.mock('../server/utils/pluto-api-config', () => ({
  getPlutoApiConfig: () => ({ cors: true, maxAge: 60 }),
}))

const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
})

const TEAM = [
  '---',
  'title: Team',
  'status: published',
  'description: Who we are',
  '---',
  '::panel{title="Crew"}',
  'Hello **team**.',
  '::',
  '',
  '<script>alert(1)</script>',
  '',
].join('\n')

const DRAFT = '---\ntitle: Soon\nstatus: draft\n---\nNot yet\n'

function event() {
  return { context: {}, node: { res: { setHeader() {}, getHeader() {} } } }
}

function setup(patch: Parameters<typeof resetTestConfig>[1] = {}) {
  const fake = createFakeGithub({
    files: {
      'content/pages/about/team.md': TEAM,
      'content/pages/soon.md': DRAFT,
    },
    users: { ada: { id: 7, permission: 'push' } },
    app: { id: '12345', installationId: 99, publicKey },
  })
  const config = resetTestConfig(fake, {
    appId: '12345',
    privateKey,
    pageType: true,
    ...patch,
  })
  registerGithubContent(config, createGithubCache({ headTtl: 0 }))
  return { fake }
}

beforeEach(() => {
  setup()
})

describe('the page type', () => {
  it('is registered with the option', () => {
    expect(getContentType('page')).toMatchObject({
      source: 'pages',
      files: { nested: true },
      api: { public: true },
    })
    expect(getContentType('page')?.fields.map((field) => field.name)).toEqual([
      'title',
      'slug',
      'description',
      'body',
    ])
    expect(
      getContentType('page')?.fields.find((field) => field.name === 'body')
    ).toMatchObject({ type: 'richtext', widget: 'blocks' })
  })

  it('is not registered by default', async () => {
    vi.resetModules()
    const registry = await import('../server/utils/pluto-content')
    const wiring =
      await import('../modules/pluto-github/runtime/server/utils/github-setup')

    wiring.registerGithubContent(
      { ...testConfig, pageType: false },
      createGithubCache({ headTtl: 0 })
    )

    expect(registry.getContentType('post')).toBeDefined()
    expect(registry.getContentType('page')).toBeUndefined()
  })

  it('gives push users its capabilities', () => {
    const { read, write, delete: remove } = plutoGithubPageType.capabilities!

    const capabilities = mapRepoPermission({ push: true })!.capabilities
    expect(capabilities).toEqual(expect.arrayContaining([read, write, remove]))
  })
})

describe('a page in the public API', () => {
  it('reads a nested page with its blocks and no html', async () => {
    const answer = await getPublicContent(event() as never, 'page', 'about/team')

    expect(answer.data).toMatchObject({
      id: 'about/team',
      title: 'Team',
      description: 'Who we are',
    })
    expect(answer.data.html).toBeUndefined()
    expect(String(answer.data.body)).toContain('::panel')
    const blocks = answer.data.blocks as { nodes: unknown[][] }
    expect(blocks.nodes[0]).toEqual([
      'panel',
      { title: 'Crew' },
      ['p', {}, 'Hello ', ['strong', {}, 'team'], '.'],
    ])
    expect(JSON.stringify(blocks)).not.toContain('script')
  })

  it('answers 404 for a draft', async () => {
    await expect(
      getPublicContent(event() as never, 'page', 'soon')
    ).rejects.toMatchObject({ statusCode: 404 })
  })

  it('lists published pages without blocks', async () => {
    const list = await listPublicContent(event() as never, 'page', {})

    expect(list.data.map((item) => item.id)).toEqual(['about/team'])
    expect(list.data[0]!.blocks).toBeUndefined()
  })
})


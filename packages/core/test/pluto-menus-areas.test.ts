import { generateKeyPairSync } from 'node:crypto'
import { join } from 'node:path'
import { getComponentMeta } from 'nuxt-component-meta/parser'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { createPlutoBlockEditor } from '../app/composables/pluto-block-editor'
import areasModule from '../modules/pluto-areas'
import {
  BLOCK_MACRO,
  BlockCatalog,
  blockComponentLoaders,
  contentComponentLoaders,
  MACRO_KEY,
} from '../modules/pluto-blocks/catalog'
import { createGithubCache } from '../modules/pluto-github/runtime/server/utils/github-cache'
import { mapRepoPermission } from '../modules/pluto-github/runtime/server/utils/github-oauth'
import { registerGithubContent } from '../modules/pluto-github/runtime/server/utils/github-setup'
import { plutoGithubAreaType } from '../modules/pluto-github/runtime/shared/area-type'
import { plutoGithubMenuType } from '../modules/pluto-github/runtime/shared/menu-type'
import menusModule from '../modules/pluto-menus'
import { parsePlutoBlocks } from '../server/utils/pluto-blocks'
import { getContentType } from '../server/utils/pluto-content'
import {
  getPublicContent,
  listPublicContent,
} from '../server/utils/pluto-public-api'
import { definePlutoAreaType } from '../shared/utils/area-type'
import { buildPalette } from '../shared/utils/blocks/editor'
import { resolveBlockDefinition } from '../shared/utils/blocks/registry'
import { plutoMenuItems } from '../shared/utils/menu-items'
import { definePlutoMenuType } from '../shared/utils/menu-type'
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

const MENU_BODY = [
  '::menu-item{label="Home" link="/"}',
  '::',
  '',
  '::menu-item{label="About" link="/about"}',
  ':::menu-item{label="Team" link="/about/team"}',
  '::::menu-item{label="Crew" link="/about/team/crew"}',
  '::::',
  ':::',
  '::',
  '',
  '::menu-item{label="Docs" link="https://example.com/docs" target="_blank"}',
  '::',
  '',
].join('\n')

const MENU = ['---', 'title: Main', 'slug: main', '---', MENU_BODY].join('\n')

const FOOTER = [
  '---',
  'title: Footer',
  'slug: footer',
  '---',
  '::panel{title="Contact"}',
  'Write **us**.',
  '::',
  '',
  '<script>alert(1)</script>',
  '',
].join('\n')

function event() {
  return { context: {}, node: { res: { setHeader() {}, getHeader() {} } } }
}

function setup(patch: Parameters<typeof resetTestConfig>[1] = {}) {
  const fake = createFakeGithub({
    files: {
      'content/menus/main.md': MENU,
      'content/areas/footer.md': FOOTER,
    },
    users: { ada: { id: 7, permission: 'push' } },
    app: { id: '12345', installationId: 99, publicKey },
  })
  const config = resetTestConfig(fake, {
    appId: '12345',
    privateKey,
    menus: true,
    areas: true,
    ...patch,
  })
  registerGithubContent(config, createGithubCache({ headTtl: 0 }))
}

async function run(module: unknown, key: string, options: object) {
  const nuxt = { options: { runtimeConfig: { public: {} } } } as any
  await (module as (options: object, nuxt: unknown) => Promise<void>)(
    options,
    nuxt
  )
  return nuxt.options.runtimeConfig.public[key]
}

describe('the switches', () => {
  it('are off by default', async () => {
    expect(await run(menusModule, 'plutoMenus', {})).toEqual({ enabled: false })
    expect(await run(areasModule, 'plutoAreas', {})).toEqual({ enabled: false })
  })

  it('expose the option', async () => {
    expect(await run(menusModule, 'plutoMenus', { enabled: true })).toEqual({
      enabled: true,
    })
    expect(await run(areasModule, 'plutoAreas', { enabled: true })).toEqual({
      enabled: true,
    })
  })
})

describe('the definitions', () => {
  const storage = {
    source: 'rows',
    timestamps: { created: 'created_at', updated: 'updated_at' },
    capabilities: { write: 'x:write', delete: 'x:write' },
  }

  it('make a live menu with a body of menu items', () => {
    const type = definePlutoMenuType(storage)

    expect(type).toMatchObject({
      name: 'menu',
      source: 'rows',
      status: false,
      api: { public: true },
      slug: { field: 'slug' },
      capabilities: { write: 'x:write' },
    })
    expect(type.icon).toBeTruthy()
    expect(type.description).toBeTruthy()
    expect(type.fields.map((field) => field.name)).toEqual([
      'title',
      'slug',
      'body',
    ])
    expect(type.fields.find((field) => field.name === 'title')).toMatchObject({
      required: true,
    })
    expect(type.fields.find((field) => field.name === 'body')).toMatchObject({
      type: 'richtext',
      widget: 'blocks',
      blocks: ['menu-item'],
    })
  })

  it('make a live area with a body of any block', () => {
    const type = definePlutoAreaType(storage)

    expect(type).toMatchObject({
      name: 'area',
      status: false,
      api: { public: true },
    })
    expect(type.fields.map((field) => field.name)).toEqual([
      'title',
      'slug',
      'body',
    ])
    const body = type.fields.find((field) => field.name === 'body')
    expect(body).toMatchObject({ type: 'richtext', widget: 'blocks' })
    expect(body).not.toHaveProperty('blocks')
  })
})

describe('the menu-item component', () => {
  const dir = join(__dirname, '..', 'app', 'components', 'content')
  const read = (file: string) =>
    getComponentMeta(file, {
      rootDir: join(__dirname, '..'),
      extendMetaFunctions: [
        { name: BLOCK_MACRO, transform: (arg) => ({ [MACRO_KEY]: arg }) },
      ],
    }) as never

  it('is in the public and the preview manifests of core', () => {
    expect(contentComponentLoaders([dir]).map((item) => item.name)).toContain(
      'menu-item'
    )
    expect(blockComponentLoaders([dir]).map((item) => item.name)).toContain(
      'menu-item'
    )
  })

  it('defines its props and the slot of sub-items', () => {
    const blocks = new BlockCatalog(() => [dir], read, {
      warn: () => {},
      debug: () => {},
    }).collect() as Record<string, unknown>

    expect(blocks['menu-item']).toMatchObject({
      hidden: true,
      props: { link: { type: 'link' }, target: { type: 'select' } },
      slots: { default: { content: 'blocks', accepts: ['menu-item'] } },
    })
  })
})

describe('plutoMenuItems', () => {
  it('turns Comark output into nested items', async () => {
    const document = await parsePlutoBlocks(MENU_BODY)

    expect(plutoMenuItems(document)).toEqual([
      { label: 'Home', to: '/', children: [] },
      {
        label: 'About',
        to: '/about',
        children: [
          {
            label: 'Team',
            to: '/about/team',
            children: [{ label: 'Crew', to: '/about/team/crew', children: [] }],
          },
        ],
      },
      {
        label: 'Docs',
        to: 'https://example.com/docs',
        target: '_blank',
        children: [],
      },
    ])
  })

  it('skips other blocks, and gives no items for no menu', async () => {
    const document = await parsePlutoBlocks(
      'Text\n\n::menu-item{label="A"}\n::\n\n::panel\nx\n::\n'
    )

    expect(plutoMenuItems(document)).toEqual([
      { label: 'A', to: '', children: [] },
    ])
    expect(plutoMenuItems(null)).toEqual([])
    expect(plutoMenuItems(undefined)).toEqual([])
  })
})

describe('the palette of a restricted editor', () => {
  const sources = {
    presets: {},
    components: {
      'menu-item': {
        label: 'Menu item',
        hidden: true,
        group: 'site',
        slots: {
          default: { content: 'blocks' as const, accepts: ['menu-item'] },
        },
      },
      note: { group: 'callouts' },
    },
  }

  function names(accepts?: string[]) {
    return buildPalette(sources as never, accepts)
      .flatMap((group) => group.entries)
      .map((entry) => entry.id)
  }

  it('lists only the accepted blocks, and no text, table or code', () => {
    expect(names(['menu-item'])).toEqual(['component:menu-item'])
  })

  it('hides a hidden block from an open palette', () => {
    const ids = names()

    expect(ids).toContain('component:note')
    expect(ids).toContain('builtin:text')
    expect(ids).not.toContain('component:menu-item')
  })

  it('reaches the editor from the option', () => {
    const restricted = createPlutoBlockEditor({
      source: () => '',
      emit: () => {},
      sources: () => sources as never,
      accepts: () => ['menu-item'],
    })
    const open = createPlutoBlockEditor({
      source: () => '',
      emit: () => {},
    })

    expect(restricted.accepts.value).toEqual(['menu-item'])
    expect(open.accepts.value).toBeUndefined()
    expect(
      resolveBlockDefinition('menu-item', { sources: sources as never }).hidden
    ).toBe(true)
  })

  it('inserts an item at the top level', () => {
    const text = ref('')
    const editor = createPlutoBlockEditor({
      source: () => text.value,
      emit: (value) => {
        text.value = value
      },
      sources: () => sources as never,
      accepts: () => ['menu-item'],
    })
    const [entry] = buildPalette(sources as never, ['menu-item']).flatMap(
      (group) => group.entries
    )

    editor.insert(entry!)

    expect(text.value).toContain('::menu-item')
  })
})

describe('the Git CMS', () => {
  beforeEach(() => {
    setup()
  })

  it('registers the menu and the area with the switches', () => {
    expect(getContentType('menu')).toMatchObject({
      source: 'menus',
      status: false,
      api: { public: true },
    })
    expect(getContentType('area')).toMatchObject({
      source: 'areas',
      status: false,
      api: { public: true },
    })
  })

  it('registers neither by default', async () => {
    vi.resetModules()
    const registry = await import('../server/utils/pluto-content')
    const wiring =
      await import('../modules/pluto-github/runtime/server/utils/github-setup')

    wiring.registerGithubContent(
      { ...testConfig, menus: false, areas: false },
      createGithubCache({ headTtl: 0 })
    )

    expect(registry.getContentType('post')).toBeDefined()
    expect(registry.getContentType('menu')).toBeUndefined()
    expect(registry.getContentType('area')).toBeUndefined()
  })

  it('registers one without the other', async () => {
    vi.resetModules()
    const registry = await import('../server/utils/pluto-content')
    const wiring =
      await import('../modules/pluto-github/runtime/server/utils/github-setup')

    wiring.registerGithubContent(
      { ...testConfig, menus: true, areas: false },
      createGithubCache({ headTtl: 0 })
    )

    expect(registry.getContentType('menu')).toBeDefined()
    expect(registry.getContentType('area')).toBeUndefined()
  })

  it('gives push users the capabilities', () => {
    const capabilities = mapRepoPermission({ push: true })!.capabilities

    expect(plutoGithubMenuType.capabilities?.write).toBe('menus:write')
    expect(plutoGithubAreaType.capabilities?.write).toBe('areas:write')
    expect(capabilities).toEqual(
      expect.arrayContaining(['menus:write', 'areas:write'])
    )
  })

  it('reads a menu with its blocks and no html', async () => {
    const answer = await getPublicContent(event() as never, 'menu', 'main')

    expect(answer.data).toMatchObject({ id: 'main', title: 'Main' })
    expect(answer.data.html).toBeUndefined()
    expect(
      plutoMenuItems(answer.data.blocks as never).map((item) => item.label)
    ).toEqual(['Home', 'About', 'Docs'])
  })

  it('reads an area with its blocks, without the script', async () => {
    const answer = await getPublicContent(event() as never, 'area', 'footer')

    expect(answer.data).toMatchObject({ id: 'footer', title: 'Footer' })
    const blocks = answer.data.blocks as { nodes: unknown[][] }
    expect(blocks.nodes[0]).toEqual([
      'panel',
      { title: 'Contact' },
      ['p', {}, 'Write ', ['strong', {}, 'us'], '.'],
    ])
    expect(JSON.stringify(blocks)).not.toContain('script')
  })

  it('answers 404 for a missing menu', async () => {
    await expect(
      getPublicContent(event() as never, 'menu', 'nope')
    ).rejects.toMatchObject({ statusCode: 404 })
  })

  it('lists menus without blocks', async () => {
    const list = await listPublicContent(event() as never, 'menu', {})

    expect(list.data.map((item) => item.id)).toEqual(['main'])
    expect(list.data[0]!.blocks).toBeUndefined()
  })
})

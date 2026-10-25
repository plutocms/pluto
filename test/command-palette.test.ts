import type { PlutoContentType } from '../shared/types/content'
import type { PlutoNavItem } from '../shared/types/registry'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'
import { createI18nStub } from './fixtures/i18n-stub'

// Same Nuxt-global stubbing as test/pluto-admin-nav-content.test.ts.
// pluto-command-palette.ts uses auto-imported globals and sibling
// composables that do not exist outside a Nuxt build.
const navItems = ref<PlutoNavItem[]>([])
const contentTypes = ref<{
 type: Partial<PlutoContentType>
}[]>([])
let granted: Set<string>
let locale = 'en'
const navigateTo = vi.fn()

beforeEach(() => {
  navItems.value = []
  contentTypes.value = []
  granted = new Set()
  locale = 'en'
  navigateTo.mockReset()

  vi.stubGlobal('computed', computed)
  vi.stubGlobal('usePlutoI18n', () => createI18nStub(locale))
  vi.stubGlobal('navigateTo', navigateTo)
  vi.stubGlobal('usePlutoAdminNav', () => ({ items: navItems }))
  vi.stubGlobal('usePlutoContentTypes', () => ({ items: contentTypes }))
  vi.stubGlobal('usePlutoPermissions', () => ({ can: (cap: string) => granted.has(cap) }))
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.resetModules()
})

async function groups() {
  const { usePlutoCommandPalette } = await import('../app/composables/pluto-command-palette')
  return usePlutoCommandPalette().value
}

const post = { name: 'post', label: 'Post', labelPlural: 'Posts', basePath: '/admin/posts', newPath: '/admin/post/new' }

describe('usePlutoCommandPalette', () => {
  it('builds a Create group from content types and a Go to group from nav', async () => {
    contentTypes.value = [{ type: post }]
    navItems.value = [
      { id: 'a', label: 'Posts', icon: 'lucide:file', to: '/admin/posts' },
      { id: 'b', label: 'Settings', to: '/admin/settings' },
    ]

    const result = await groups()

    expect(result.map((group) => group.id)).toEqual(['pluto-create', 'pluto-go-to'])
    expect(result[0]!.items!.map((item) => item.label)).toEqual(['New Post'])
    expect(result[1]!.items!.map((item) => item.label)).toEqual(['Posts', 'Settings'])
  })

  it('falls back to <basePath>/new, then /admin/content/<name>/new', async () => {
    contentTypes.value = [
      { type: { name: 'page', label: 'Page', labelPlural: 'Pages', basePath: '/admin/pages' } },
      { type: { name: 'faq', label: 'FAQ', labelPlural: 'FAQs' } },
    ]

    const [create] = await groups()
    create!.items![0]!.onSelect!(new Event('select'))
    create!.items![1]!.onSelect!(new Event('select'))

    expect(navigateTo.mock.calls).toEqual([['/admin/pages/new'], ['/admin/content/faq/new']])
  })

  it('lists nav children with the parent label as suffix', async () => {
    navItems.value = [{ id: 'a', label: 'Posts', icon: 'lucide:file', children: [{ label: 'All posts', to: '/admin/posts' }] }]

    const [goTo] = await groups()

    expect(goTo!.items![0]).toMatchObject({ label: 'All posts', suffix: 'Posts', icon: 'lucide:file' })
  })

  it('shows each destination once, preferring the Create command', async () => {
    contentTypes.value = [{ type: post }]
    navItems.value = [{ id: 'a', label: 'Posts', children: [{ label: 'Create new post', to: '/admin/post/new' }, { label: 'All posts', to: '/admin/posts' }] }]

    const [create, goTo] = await groups()

    expect(create!.items!.map((item) => item.label)).toEqual(['New Post'])
    expect(goTo!.items!.map((item) => item.label)).toEqual(['All posts'])
  })

  it('hides Create commands the user lacks the write capability for', async () => {
    contentTypes.value = [
      { type: { ...post, capabilities: { write: 'posts:publish' } } },
      { type: { name: 'faq', label: 'FAQ', labelPlural: 'FAQs' } },
    ]

    expect((await groups())[0]!.items!.map((item) => item.label)).toEqual(['New FAQ'])

    granted.add('posts:publish')
    vi.resetModules()
    expect((await groups())[0]!.items!.map((item) => item.label)).toEqual(['New Post', 'New FAQ'])
  })

  it('lists the settings pages once, with General as "Settings"', async () => {
    navItems.value = [
      {
        id: 's',
        label: 'Settings',
        to: '/admin/settings',
        children: [
          { label: 'General', to: '/admin/settings' },
          { label: 'Users', to: '/admin/settings/users' },
        ],
      },
    ]

    const [goTo] = await groups()

    expect(goTo!.items!.map((item) => item.label)).toEqual(['Settings', 'Users'])
    expect(goTo!.items![1]).toMatchObject({ suffix: 'Settings' })
  })

  it('translates its own group labels', async () => {
    contentTypes.value = [{ type: post }]
    navItems.value = [{ id: 'b', label: 'Settings', to: '/admin/settings' }]

    expect((await groups()).map((group) => group.label)).toEqual(['Create', 'Go to'])

    locale = 'pt-BR'
    vi.resetModules()
    expect((await groups()).map((group) => group.label)).toEqual(['Criar', 'Ir para'])
  })

  it('resolves a key label and passes a plain label through', async () => {
    navItems.value = [
      { id: 'a', label: 'pluto.nav.home', to: '/admin/home' },
      { id: 'b', label: 'Posts', to: '/admin/posts', children: [{ label: 'pluto.content.typeNotFound', to: '/admin/posts/x' }] },
    ]

    const [goTo] = await groups()

    expect(goTo!.items!.map((item) => item.label)).toEqual(['Home', 'Posts', 'Content type not found'])
    expect(goTo!.items![2]).toMatchObject({ suffix: 'Posts' })
  })

  it('uses the convention keys of a content type, with the English literal as the fallback', async () => {
    contentTypes.value = [
      { type: { name: 'post', label: 'Post', labelPlural: 'Posts' } },
      { type: { name: 'unknown-type', label: 'Thing', labelPlural: 'Things' } },
    ]
    const messages = { 'content.post.label': 'Artigo', 'content.post.labelPlural': 'Artigos', 'content.post.new': 'Novo artigo' }
    vi.stubGlobal('usePlutoI18n', () => ({
      ...createI18nStub(),
      te: (key: string) => key in messages,
      t: (key: string, params?: Record<string, unknown>) => messages[key as keyof typeof messages] ?? (params ? `New ${params.label}` : key),
    }))

    const [create] = await groups()

    expect(create!.items!.map((item) => item.label)).toEqual(['Novo artigo', 'New Thing'])
    expect(create!.items!.map((item) => item.suffix)).toEqual(['Artigos', 'Things'])
  })

  it('drops empty groups', async () => {
    expect(await groups()).toEqual([])
  })
})

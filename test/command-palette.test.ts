import type { PlutoContentType } from '../shared/types/content'
import type { PlutoNavItem } from '../shared/types/registry'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'

// Same Nuxt-global stubbing as test/pluto-admin-nav-content.test.ts.
// pluto-command-palette.ts uses auto-imported globals and sibling
// composables that do not exist outside a Nuxt build.
const navItems = ref<PlutoNavItem[]>([])
const contentTypes = ref<{
 type: Partial<PlutoContentType>
}[]>([])
let granted: Set<string>
const navigateTo = vi.fn()

beforeEach(() => {
  navItems.value = []
  contentTypes.value = []
  granted = new Set()
  navigateTo.mockReset()

  vi.stubGlobal('computed', computed)
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

  it('drops empty groups', async () => {
    expect(await groups()).toEqual([])
  })
})

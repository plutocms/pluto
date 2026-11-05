import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'

const infoName = ref<string | undefined>(undefined)
const infoUrl = ref<string | undefined>(undefined)

vi.mock('../app/composables/pluto-navbar', () => ({
  usePlutoSiteInfo: () => ({
    name: computed(() => infoName.value),
    url: computed(() => infoUrl.value),
  }),
}))

let config: Record<string, unknown> = {}
let appConfig: { baseURL: string } = { baseURL: '/' }
const head = vi.fn()
const seo = vi.fn()

beforeEach(() => {
  infoName.value = undefined
  infoUrl.value = undefined
  config = { websiteName: 'My Blog', websiteDescription: 'Notes and stories.' }
  appConfig = { baseURL: '/' }
  vi.stubGlobal('useRuntimeConfig', () => ({ public: config, app: appConfig }))
  vi.stubGlobal('useRequestURL', () => new URL('https://blog.example.com/x'))
  vi.stubGlobal('useHead', head)
  vi.stubGlobal('useSeoMeta', seo)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

const { usePlutoSite, usePlutoSiteHead } =
  await import('../app/composables/pluto-site')

describe('usePlutoSite', () => {
  it('reads the site info first, then the runtime config', () => {
    const site = usePlutoSite()
    expect(site.name.value).toBe('My Blog')
    expect(site.description.value).toBe('Notes and stories.')
    expect(site.url.value).toBe('https://blog.example.com')

    infoName.value = 'Shop of Ada'
    infoUrl.value = 'https://ada.example.com'
    expect(site.name.value).toBe('Shop of Ada')
    expect(site.url.value).toBe('https://ada.example.com')
  })

  it('has no name while the config holds the default "Untitled"', () => {
    config = { websiteName: 'Untitled' }
    expect(usePlutoSite().name.value).toBe('')
    expect(usePlutoSite().description.value).toBe('')
  })
})

describe('usePlutoSite, the site URL', () => {
  it('uses websiteUrl for url and root, and adds the base path', () => {
    config = { websiteUrl: 'https://user.github.io' }
    appConfig = { baseURL: '/repo/' }
    infoUrl.value = 'https://ada.example.com'

    const site = usePlutoSite()
    expect(site.url.value).toBe('https://user.github.io')
    expect(site.root.value).toBe('https://user.github.io/repo')
    expect(site.absoluteUrl('/posts/a')).toBe(
      'https://user.github.io/repo/posts/a'
    )
  })

  it('falls back to the request origin and the base path', () => {
    appConfig = { baseURL: '/repo/' }

    const site = usePlutoSite()
    expect(site.root.value).toBe('https://blog.example.com/repo')
    expect(site.absoluteUrl('/feed.xml')).toBe(
      'https://blog.example.com/repo/feed.xml'
    )
  })

  it('never takes the root from the site info', () => {
    infoUrl.value = 'https://ada.example.com'

    expect(usePlutoSite().root.value).toBe('https://blog.example.com')
  })

  it('has no root on a static build without websiteUrl', () => {
    config = { plutoPublicApi: { static: true } }

    const site = usePlutoSite()
    expect(site.root.value).toBe('')
    expect(site.absoluteUrl('/posts/a')).toBe('')
    expect(site.absoluteUrl('https://cdn.io/a.png')).toBe(
      'https://cdn.io/a.png'
    )
  })

  it('has a root on a static build with websiteUrl', () => {
    config = {
      websiteUrl: 'https://user.github.io/repo',
      plutoPublicApi: { static: true },
    }
    appConfig = { baseURL: '/repo/' }

    expect(usePlutoSite().root.value).toBe('https://user.github.io/repo')
  })
})

describe('usePlutoSiteHead', () => {
  it('sets the title template, the site name and the default description', () => {
    usePlutoSiteHead()
    const { titleTemplate } = head.mock.calls[0]![0] as {
      titleTemplate: (title?: string) => string
    }
    expect(titleTemplate('Hello')).toBe('Hello - My Blog')
    expect(titleTemplate('My Blog')).toBe('My Blog')
    expect(titleTemplate()).toBe('My Blog')

    const tags = seo.mock.calls[0]![0] as Record<string, () => unknown>
    expect(tags.description!()).toBe('Notes and stories.')
    expect(tags.ogSiteName!()).toBe('My Blog')
  })

  it('keeps the page title alone when the site has no name', () => {
    config = {}
    usePlutoSiteHead()
    const { titleTemplate } = head.mock.calls[0]![0] as {
      titleTemplate: (title?: string) => string
    }
    expect(titleTemplate('Hello')).toBe('Hello')
    const tags = seo.mock.calls[0]![0] as Record<string, () => unknown>
    expect(tags.description!()).toBeUndefined()
  })
})

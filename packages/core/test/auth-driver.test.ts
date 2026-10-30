import type { PlutoAuthDriver, PlutoRegistry } from '../shared/types/registry'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'
import { validatePlutoAuthDriver } from '../shared/utils/auth-driver'
import { createI18nStub } from './fixtures/i18n-stub'

const SignIn = { render: () => null }

function driver(overrides: Partial<PlutoAuthDriver> = {}): PlutoAuthDriver {
  return {
    id: 'main',
    user: () => null,
    ready: async () => {},
    signOut: async () => {},
    signIn: SignIn,
    ...overrides,
  }
}

describe('validatePlutoAuthDriver', () => {
  it('accepts a minimal driver', () => {
    expect(validatePlutoAuthDriver(driver())).toEqual([])
  })

  it('accepts a full driver', () => {
    const full = driver({
      loggedIn: () => true,
      refresh: async () => {},
      guard: () => undefined,
      signInTitle: 'Sign in',
      signInDescription: 'Use your account.',
      links: { signUp: '/sign-up', forgotPassword: '/forgot' },
      publicPaths: [
        '/admin/reset',
        { path: '/admin/invite', signedIn: 'allow' },
      ],
    })
    expect(validatePlutoAuthDriver(full)).toEqual([])
  })

  it('reports a missing function and a missing component', () => {
    const problems = validatePlutoAuthDriver({ id: 'x' })
    expect(problems).toHaveLength(4)
    expect(problems.join(' ')).toContain('"user"')
    expect(problems.join(' ')).toContain('"ready"')
    expect(problems.join(' ')).toContain('"signOut"')
    expect(problems.join(' ')).toContain('"signIn"')
  })

  it('reports a wrong optional field', () => {
    const problems = validatePlutoAuthDriver({
      ...driver(),
      loggedIn: true as unknown as () => boolean,
      signInTitle: 5 as unknown as string,
      links: { signUp: 1 as unknown as string },
    })
    expect(problems).toHaveLength(3)
  })

  it('reports a guard that is not a function', () => {
    const problems = validatePlutoAuthDriver(
      driver({ guard: '/admin/setup' as unknown as () => undefined })
    )
    expect(problems).toEqual(['"guard" must be a function when set.'])
  })

  it('reports a bad public path', () => {
    const problems = validatePlutoAuthDriver(
      driver({
        publicPaths: ['reset', { path: '/ok', signedIn: 'maybe' as 'allow' }],
      })
    )
    expect(problems).toHaveLength(2)
  })

  it('reports a value that is not an object', () => {
    expect(validatePlutoAuthDriver(null)).toHaveLength(1)
  })
})

let fakeNuxtApp: {
  _plutoRegistry?: PlutoRegistry
}

beforeEach(() => {
  fakeNuxtApp = {}
  vi.stubGlobal('useNuxtApp', () => fakeNuxtApp)
  vi.stubGlobal('computed', computed)
  vi.stubGlobal('ref', ref)
  vi.stubGlobal('usePlutoI18n', () => createI18nStub())
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.resetModules()
})

async function load() {
  const { usePlutoRegistry } = await import('../app/composables/pluto-registry')
  vi.stubGlobal('usePlutoRegistry', usePlutoRegistry)
  const { definePlutoExtension } =
    await import('../app/composables/pluto-extension')
  const { usePlutoAccountMenu, usePlutoSiteInfo } =
    await import('../app/composables/pluto-navbar')
  return {
    usePlutoRegistry,
    definePlutoExtension,
    usePlutoAccountMenu,
    usePlutoSiteInfo,
  }
}

describe('auth driver registry', () => {
  it('lets the last registered driver win', async () => {
    const { usePlutoRegistry, definePlutoExtension } = await load()
    definePlutoExtension({ id: 'first', authDriver: driver({ id: 'a' }) })
    definePlutoExtension({ id: 'second', authDriver: driver({ id: 'b' }) })

    expect(usePlutoRegistry().authDrivers.list.value.at(-1)?.id).toBe(
      'second:b'
    )
  })

  it('removes a driver when the same extension registers again without it', async () => {
    const { usePlutoRegistry, definePlutoExtension } = await load()
    definePlutoExtension({ id: 'first', authDriver: driver() })
    definePlutoExtension({ id: 'first' })

    expect(usePlutoRegistry().authDrivers.list.value).toHaveLength(0)
  })
})

describe('account menu', () => {
  it('sorts the items by order and resolves keys and literals', async () => {
    const { definePlutoExtension, usePlutoAccountMenu } = await load()
    definePlutoExtension({
      id: 'a',
      accountMenu: [{ id: 'late', label: 'Late item', order: 200 }],
    })
    definePlutoExtension({
      id: 'b',
      accountMenu: [
        { id: 'early', label: 'pluto.common.settings', order: 10 },
        { id: 'default', label: 'Default item' },
      ],
    })

    expect(usePlutoAccountMenu().items.value.map((item) => item.label)).toEqual(
      ['Settings', 'Default item', 'Late item']
    )
  })
})

describe('site info', () => {
  it('uses the last site that has a value for each field', async () => {
    const { definePlutoExtension, usePlutoSiteInfo } = await load()
    definePlutoExtension({
      id: 'a',
      site: {
        id: 'site',
        name: () => 'Alpha',
        url: () => 'https://alpha.test',
      },
    })
    definePlutoExtension({
      id: 'b',
      site: { id: 'site', name: () => null, url: () => 'https://beta.test' },
    })

    const site = usePlutoSiteInfo()
    expect(site.name.value).toBe('Alpha')
    expect(site.url.value).toBe('https://beta.test')
  })

  it('gives undefined with no site', async () => {
    const { usePlutoSiteInfo } = await load()
    expect(usePlutoSiteInfo().url.value).toBeUndefined()
  })
})

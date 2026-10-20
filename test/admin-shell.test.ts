import type { PlutoAuthPublicPath } from '../shared/types/registry'
import { describe, expect, it } from 'vitest'
import {
  displayName,
  guardDecision,
  isAdminPath,
  navbarVisible,
  normalizePublicPaths,
  safeRedirect,
  shortName,
} from '../app/composables/internal/admin-shell'

const publicPaths = normalizePublicPaths(['/admin/reset', { path: '/admin/invite', signedIn: 'allow' }])

describe('isAdminPath', () => {
  it('matches /admin and its children only', () => {
    expect(isAdminPath('/admin')).toBe(true)
    expect(isAdminPath('/admin/home')).toBe(true)
    expect(isAdminPath('/administrator')).toBe(false)
    expect(isAdminPath('/')).toBe(false)
  })
})

describe('normalizePublicPaths', () => {
  it('always has the login path with redirect', () => {
    expect(normalizePublicPaths(undefined)).toEqual([{ path: '/admin/login', signedIn: 'redirect' }])
  })

  it('keeps the login redirect rule when the driver lists it', () => {
    const result = normalizePublicPaths([{ path: '/admin/login', signedIn: 'allow' }])
    expect(result).toEqual([{ path: '/admin/login', signedIn: 'redirect' }])
  })

  it('turns strings into objects, trims a trailing slash and drops duplicates', () => {
    const result = normalizePublicPaths(['/admin/reset/', '/admin/reset'])
    expect(result.map((entry) => entry.path)).toEqual(['/admin/login', '/admin/reset'])
    expect(result[1]?.signedIn).toBe('redirect')
  })
})

describe('safeRedirect', () => {
  it('accepts a local path with a query and a hash', () => {
    expect(safeRedirect('/admin/posts?page=2#top')).toBe('/admin/posts?page=2#top')
  })

  it.each([
    ['//evil.example'],
    ['/\\evil.example'],
    ['https://evil.example'],
    ['javascript:alert(1)'],
    ['/\t/evil.example'],
    ['/\n/evil.example'],
    ['/a\u0000b'],
    [''],
    ['admin/home'],
    [`/${'a'.repeat(2048)}`],
  ])('rejects %j', (value) => {
    expect(safeRedirect(value)).toBe('')
  })

  it('rejects a value that is not a string', () => {
    expect(safeRedirect(undefined)).toBe('')
    expect(safeRedirect(['/admin'])).toBe('')
    expect(safeRedirect(42)).toBe('')
  })
})

describe('guardDecision', () => {
  function decide(
    path: string,
    loggedIn: boolean,
    query: Record<string, unknown> = {},
    fullPath = path,
    paths: PlutoAuthPublicPath[] = publicPaths
  ) {
    return guardDecision({ path, fullPath, query, loggedIn, publicPaths: paths })
  }

  it('allows a path outside /admin', () => {
    expect(decide('/shop', false)).toEqual({ action: 'allow' })
  })

  it('sends a signed-out user to the login page with the wanted path', () => {
    expect(decide('/admin/posts', false, {}, '/admin/posts?page=2')).toEqual({
      action: 'redirect',
      to: '/admin/login?redirect=%2Fadmin%2Fposts%3Fpage%3D2',
    })
  })

  it('allows a signed-in user on a private admin path', () => {
    expect(decide('/admin/posts', true)).toEqual({ action: 'allow' })
  })

  it('allows a signed-out user on a public auth path', () => {
    expect(decide('/admin/login', false)).toEqual({ action: 'allow' })
    expect(decide('/admin/reset/step-2', false)).toEqual({ action: 'allow' })
  })

  it('sends a signed-in user from the login page to the home', () => {
    expect(decide('/admin/login', true)).toEqual({ action: 'redirect', to: '/admin/home' })
  })

  it('sends a signed-in user to a safe redirect target', () => {
    expect(decide('/admin/login', true, { redirect: '/admin/posts' })).toEqual({ action: 'redirect', to: '/admin/posts' })
    expect(decide('/admin/login', true, { redirect: ['/admin/posts', '/x'] })).toEqual({ action: 'redirect', to: '/admin/posts' })
  })

  it('ignores an unsafe redirect target', () => {
    expect(decide('/admin/login', true, { redirect: '//evil.example' })).toEqual({ action: 'redirect', to: '/admin/home' })
  })

  it('does not loop when the target is a public path that redirects', () => {
    expect(decide('/admin/login', true, { redirect: '/admin/login' })).toEqual({ action: 'redirect', to: '/admin/home' })
  })

  it('allows a signed-in user on a path with signedIn allow', () => {
    expect(decide('/admin/invite', true)).toEqual({ action: 'allow' })
  })
})

describe('navbarVisible', () => {
  const base = { loggedIn: true, isStaff: true, capabilitiesKnown: true, publicPaths }

  it('hides the bar for a signed-out user everywhere', () => {
    expect(navbarVisible({ ...base, path: '/admin/home', loggedIn: false })).toBe(false)
    expect(navbarVisible({ ...base, path: '/', loggedIn: false })).toBe(false)
  })

  it('shows on /admin/** for any signed-in user, before the capabilities load', () => {
    expect(navbarVisible({ ...base, path: '/admin/home', isStaff: false, capabilitiesKnown: false })).toBe(true)
  })

  it('hides on the public auth paths', () => {
    expect(navbarVisible({ ...base, path: '/admin/login' })).toBe(false)
    expect(navbarVisible({ ...base, path: '/admin/invite' })).toBe(false)
  })

  it('shows on a public page for staff once the capabilities are known', () => {
    expect(navbarVisible({ ...base, path: '/' })).toBe(true)
  })

  it('hides on a public page for a customer', () => {
    expect(navbarVisible({ ...base, path: '/', isStaff: false })).toBe(false)
  })

  it('hides on a public page while the capabilities are unknown', () => {
    expect(navbarVisible({ ...base, path: '/', capabilitiesKnown: false })).toBe(false)
    expect(navbarVisible({ ...base, path: '/', isStaff: false, capabilitiesKnown: false })).toBe(false)
  })
})

describe('displayName and shortName', () => {
  it('uses the name, then the username, then the fallback', () => {
    expect(displayName({ id: '1', name: 'Ada Lovelace', username: 'ada' }, 'Account')).toBe('Ada Lovelace')
    expect(displayName({ id: '1', username: 'ada' }, 'Account')).toBe('ada')
    expect(displayName({ id: '1', name: '  ' }, 'Account')).toBe('Account')
    expect(displayName(null, 'Account')).toBe('Account')
  })

  it('gives the first word as the short name', () => {
    expect(shortName({ id: '1', name: 'Ada Lovelace' }, 'Account')).toBe('Ada')
    expect(shortName({ id: '1', username: 'ada' }, 'Account')).toBe('ada')
    expect(shortName(undefined, 'Account')).toBe('Account')
  })
})

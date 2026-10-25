import type { PlutoAuthPublicPath } from '../shared/types/registry'
import { describe, expect, it } from 'vitest'
import {
  ADMIN_NO_ACCESS_PATH,
  displayName,
  guardDecision,
  isAdminPath,
  isStaff,
  navbarVisible,
  normalizePublicPaths,
  resolveSiteName,
  safeRedirect,
  shortName,
  staffDecision,
} from '../app/composables/internal/admin-shell'
import { isPlutoPreviewPath } from '../shared/utils/preview-path'

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

  it('hides on /admin/** for a user known to be no staff', () => {
    expect(navbarVisible({ ...base, path: '/admin/home', isStaff: false })).toBe(false)
    expect(navbarVisible({ ...base, path: '/admin/no-access', isStaff: false })).toBe(false)
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

  it('hides when the route hides the bar (hiddenByRoute)', () => {
    expect(navbarVisible({ ...base, path: '/docs', hiddenByRoute: true })).toBe(false)
    expect(navbarVisible({ ...base, path: '/admin/home', hiddenByRoute: true })).toBe(false)
    expect(navbarVisible({ ...base, path: '/docs', hiddenByRoute: false })).toBe(true)
  })

})

describe('isPlutoPreviewPath', () => {
  it('matches the preview path and its children only', () => {
    expect(isPlutoPreviewPath('/_pluto/preview')).toBe(true)
    expect(isPlutoPreviewPath('/_pluto/preview/')).toBe(true)
    expect(isPlutoPreviewPath('/_pluto/preview/x')).toBe(true)
    expect(isPlutoPreviewPath('/_pluto/previews')).toBe(false)
    expect(isPlutoPreviewPath('/_pluto')).toBe(false)
    expect(isPlutoPreviewPath('/admin/home')).toBe(false)
  })
})

describe('isStaff', () => {
  it('counts every user as staff when there is no permissions driver', () => {
    expect(isStaff(false, [])).toBe(true)
  })

  it('needs at least one capability when a driver exists', () => {
    expect(isStaff(true, [])).toBe(false)
    expect(isStaff(true, ['posts:read'])).toBe(true)
    expect(isStaff(true, ['*'])).toBe(true)
  })
})

describe('staffDecision', () => {
  const input = {
    path: '/admin/home',
    fullPath: '/admin/home',
    query: {},
    publicPaths,
    hasDriver: true,
    granted: ['posts:read'],
    loadFailed: false,
  }

  it('allows a path outside the admin', () => {
    expect(staffDecision({ ...input, path: '/shop', fullPath: '/shop', granted: [] })).toEqual({ action: 'allow' })
  })

  it('never checks a public auth path', () => {
    expect(staffDecision({ ...input, path: '/admin/reset', granted: [], loadFailed: true })).toEqual({ action: 'allow' })
    expect(staffDecision({ ...input, path: '/admin/invite', granted: [] })).toEqual({ action: 'allow' })
  })

  it('allows everyone when there is no permissions driver', () => {
    expect(staffDecision({ ...input, hasDriver: false, granted: [] })).toEqual({ action: 'allow' })
  })

  it('allows staff on a private path', () => {
    expect(staffDecision(input)).toEqual({ action: 'allow' })
    expect(staffDecision({ ...input, granted: ['*'] })).toEqual({ action: 'allow' })
  })

  it('sends a user with no capability to the no-access page and keeps the wanted path', () => {
    expect(staffDecision({ ...input, granted: [], fullPath: '/admin/content/posts?page=2' })).toEqual({
      action: 'redirect',
      to: `${ADMIN_NO_ACCESS_PATH}?redirect=${encodeURIComponent('/admin/content/posts?page=2')}`,
    })
  })

  it('sends a load error to the no-access page with reason=error', () => {
    expect(staffDecision({ ...input, granted: [], loadFailed: true })).toEqual({
      action: 'redirect',
      to: `${ADMIN_NO_ACCESS_PATH}?reason=error&redirect=${encodeURIComponent('/admin/home')}`,
    })
    // A stale list never counts as staff when the load failed.
    expect(staffDecision({ ...input, loadFailed: true }).action).toBe('redirect')
  })

  it('keeps a non-staff user on the no-access page (no loop)', () => {
    const base = { ...input, path: ADMIN_NO_ACCESS_PATH, fullPath: ADMIN_NO_ACCESS_PATH, granted: [] }
    expect(staffDecision(base)).toEqual({ action: 'allow' })
    expect(staffDecision({ ...base, loadFailed: true })).toEqual({ action: 'allow' })
  })

  it('sends staff away from the no-access page to the redirect target or the home', () => {
    const base = { ...input, path: ADMIN_NO_ACCESS_PATH, fullPath: ADMIN_NO_ACCESS_PATH }
    expect(staffDecision(base)).toEqual({ action: 'redirect', to: '/admin/home' })
    expect(staffDecision({ ...base, query: { redirect: '/admin/content/posts' } })).toEqual({
      action: 'redirect',
      to: '/admin/content/posts',
    })
  })

  it('ignores an unsafe or looping redirect target', () => {
    const base = { ...input, path: ADMIN_NO_ACCESS_PATH, fullPath: ADMIN_NO_ACCESS_PATH }
    expect(staffDecision({ ...base, query: { redirect: 'https://evil.example' } })).toEqual({
      action: 'redirect',
      to: '/admin/home',
    })
    expect(staffDecision({ ...base, query: { redirect: ADMIN_NO_ACCESS_PATH } })).toEqual({
      action: 'redirect',
      to: '/admin/home',
    })
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

describe('resolveSiteName', () => {
  it('prefers the site info name', () => {
    expect(resolveSiteName('Emi', 'My Blog', 'Pluto Admin')).toBe('Emi')
  })

  it('uses the website name when there is no site info name', () => {
    expect(resolveSiteName(undefined, 'My Blog', 'Pluto Admin')).toBe('My Blog')
    expect(resolveSiteName('', 'My Blog', 'Pluto Admin')).toBe('My Blog')
  })

  it('skips the default Untitled website name', () => {
    expect(resolveSiteName(undefined, 'Untitled', 'Pluto Admin')).toBe('Pluto Admin')
    expect(resolveSiteName(undefined, undefined, 'Pluto Admin')).toBe('Pluto Admin')
  })
})

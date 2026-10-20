import { describe, expect, it, vi } from 'vitest'
import { isSameOriginRequest } from '../modules/pluto-cms/runtime/server/utils/origin'
import { createAuthApp, resetTestConfig } from './fixtures/cms-auth-harness'

vi.mock('../modules/pluto-cms/runtime/server/utils/cms-config', async () => {
  const { testConfig } = await import('./fixtures/cms-test-config')
  return { getCmsConfig: () => testConfig }
})

const base = { method: 'POST', path: '/api/_pluto/content/post', host: 'cms.test', origin: undefined, referer: undefined }

describe('isSameOriginRequest', () => {
  it('allows a same-origin write', () => {
    for (const method of ['POST', 'PATCH', 'PUT', 'DELETE']) {
      expect(isSameOriginRequest({ ...base, method, origin: 'http://cms.test' }), method).toBe(true)
      expect(isSameOriginRequest({ ...base, method, origin: 'https://cms.test' }), method).toBe(true)
    }
  })

  it('rejects a cross-origin write', () => {
    for (const method of ['POST', 'PATCH', 'PUT', 'DELETE']) {
      expect(isSameOriginRequest({ ...base, method, origin: 'https://evil.test' }), method).toBe(false)
    }
  })

  it('compares the port too', () => {
    expect(isSameOriginRequest({ ...base, host: 'localhost:3000', origin: 'http://localhost:3000' })).toBe(true)
    expect(isSameOriginRequest({ ...base, host: 'localhost:3000', origin: 'http://localhost:3001' })).toBe(false)
    expect(isSameOriginRequest({ ...base, host: 'localhost:3000', origin: 'http://localhost' })).toBe(false)
  })

  it('does not take a prefix or a suffix as a match', () => {
    expect(isSameOriginRequest({ ...base, origin: 'http://cms.test.evil.test' })).toBe(false)
    expect(isSameOriginRequest({ ...base, origin: 'http://evilcms.test' })).toBe(false)
    expect(isSameOriginRequest({ ...base, origin: 'http://cms.test@evil.test' })).toBe(false)
  })

  it('ignores a default port and the case of the host', () => {
    expect(isSameOriginRequest({ ...base, host: 'CMS.test:443', origin: 'https://cms.test' })).toBe(true)
    expect(isSameOriginRequest({ ...base, host: 'cms.test:80', origin: 'http://CMS.TEST' })).toBe(true)
  })

  it('uses Referer when Origin is absent', () => {
    expect(isSameOriginRequest({ ...base, referer: 'https://cms.test/admin/home' })).toBe(true)
    expect(isSameOriginRequest({ ...base, referer: 'https://evil.test/admin/home' })).toBe(false)
  })

  it('prefers Origin over Referer', () => {
    expect(isSameOriginRequest({ ...base, origin: 'https://evil.test', referer: 'https://cms.test/' })).toBe(false)
  })

  it('rejects a write with neither header', () => {
    expect(isSameOriginRequest({ ...base })).toBe(false)
  })

  it('rejects a bad Origin, such as null', () => {
    for (const origin of ['null', 'not a url', 'file:///etc/passwd', 'javascript:alert(1)']) {
      expect(isSameOriginRequest({ ...base, origin }), origin).toBe(false)
    }
  })

  it('rejects a write with no Host header', () => {
    expect(isSameOriginRequest({ ...base, host: undefined, origin: 'http://cms.test' })).toBe(false)
  })

  it('allows a safe method with no header', () => {
    for (const method of ['GET', 'HEAD', 'OPTIONS']) {
      expect(isSameOriginRequest({ ...base, method }), method).toBe(true)
    }
  })

  it('checks only /api/_pluto', () => {
    expect(isSameOriginRequest({ ...base, path: '/api/other' })).toBe(true)
    expect(isSameOriginRequest({ ...base, path: '/api/_plutox/a' })).toBe(true)
    expect(isSameOriginRequest({ ...base, path: '/api/_pluto' })).toBe(false)
    expect(isSameOriginRequest({ ...base, path: '/api/_pluto/auth/logout?x=1' })).toBe(false)
  })
})

describe('the origin middleware', () => {
  it('rejects a cross-origin POST, PATCH and DELETE with 403', async () => {
    resetTestConfig()
    const app = createAuthApp()

    for (const method of ['POST', 'PATCH', 'DELETE']) {
      const response = await app.request('/api/_pluto/echo', { method, headers: { origin: 'https://evil.test' } })

      expect(response.status, method).toBe(403)
    }
  })

  it('does not run the route of a cross-origin request', async () => {
    resetTestConfig()
    const app = createAuthApp()

    const response = await app.request('/api/_pluto/auth/logout', { method: 'POST', headers: { origin: 'https://evil.test' } })

    expect(response.status).toBe(403)
    expect((await response.json()).data.i18n.key).toBe('pluto.cms.errors.crossOrigin')
    expect(response.headers.getSetCookie()).toEqual([])
  })

  it('allows a same-origin POST', async () => {
    resetTestConfig()
    const app = createAuthApp()

    expect((await app.request('/api/_pluto/echo', { method: 'POST' })).status).toBe(200)
    expect((await app.request('/api/_pluto/echo', { method: 'POST', headers: { referer: 'http://cms.test/admin/home' } })).status).toBe(200)
  })

  it('allows a GET from another origin', async () => {
    resetTestConfig()
    const app = createAuthApp()

    expect((await app.request('/api/_pluto/echo', { headers: { origin: 'https://evil.test' } })).status).toBe(200)
  })

  it('rejects a write with neither Origin nor Referer', async () => {
    resetTestConfig()
    const app = createAuthApp()

    const response = await app.request('/api/_pluto/echo', { method: 'POST', sameOrigin: false })

    expect(response.status).toBe(403)
  })

  it('does not trust x-forwarded-host', async () => {
    resetTestConfig()
    const app = createAuthApp()

    const response = await app.request('/api/_pluto/echo', {
      method: 'POST',
      headers: { 'origin': 'https://evil.test', 'x-forwarded-host': 'evil.test' },
    })

    expect(response.status).toBe(403)
  })
})

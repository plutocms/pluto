import { createHash } from 'node:crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  buildAuthorizeUrl,
  mapRepoPermission,
  oauthBaseUrl,
  safeEqual,
  safeRedirect,
} from '../modules/pluto-github/runtime/server/utils/github-oauth'
import { isLocalRequest } from '../modules/pluto-github/runtime/server/utils/session'
import { plutoGithubPostType } from '../modules/pluto-github/runtime/shared/post-type'
import { createFakeGithub } from './fixtures/fake-github'
import { createAuthApp, fakeEvent, resetTestConfig, signIn, testConfig } from './fixtures/github-auth-harness'

vi.mock('../modules/pluto-github/runtime/server/utils/github-config', async () => {
  const { testConfig } = await import('./fixtures/github-test-config')
  return { getGithubConfig: () => testConfig }
})

const POST_CAPS = ['posts:read_drafts', 'posts:publish', 'posts:delete']

function setup(patch: Parameters<typeof resetTestConfig>[1] = {}, repoPrivate = true) {
  const fake = createFakeGithub({
    private: repoPrivate,
    users: {
      ada: { id: 7, name: 'Ada Lovelace', permission: 'push' },
      boss: { id: 8, permission: 'admin' },
      lead: { id: 9, permission: 'maintain' },
      reader: { id: 10, permission: 'read' },
      stranger: { id: 11, permission: 'push', installed: false },
    },
  })
  resetTestConfig(fake, patch)
  return { fake, app: createAuthApp() }
}

describe('safeRedirect', () => {
  it('keeps a path on this site', () => {
    expect(safeRedirect('/admin/content/post?x=1#top')).toBe('/admin/content/post?x=1#top')
    expect(safeRedirect('/')).toBe('/')
  })

  it('refuses every other target', () => {
    const attacks = [
      '//evil.com',
      '/\\evil.com',
      '\\\\evil.com',
      'https://evil.com',
      'http://evil.com/admin',
      'javascript:alert(1)',
      'evil.com',
      '/\t/evil.com',
      '/\n/evil.com',
      '/\u0000/evil.com',
      '',
      undefined,
      ['/a'],
      123,
      `/${'a'.repeat(3000)}`,
    ]
    for (const attack of attacks) {
      expect(safeRedirect(attack), String(attack)).toBe('/admin/home')
    }
  })

  it('uses the given fallback', () => {
    expect(safeRedirect('//evil.com', '/x')).toBe('/x')
  })
})

describe('github oauth helpers', () => {
  it('builds the authorize url with state and PKCE', () => {
    const url = new URL(buildAuthorizeUrl({
      clientId: 'cid',
      redirectUri: 'https://site.test/api/_pluto/auth/github/callback',
      state: 'st',
      codeChallenge: 'ch',
    }))

    expect(`${url.origin}${url.pathname}`).toBe('https://github.com/login/oauth/authorize')
    expect(Object.fromEntries(url.searchParams)).toEqual({
      client_id: 'cid',
      redirect_uri: 'https://site.test/api/_pluto/auth/github/callback',
      state: 'st',
      code_challenge: 'ch',
      code_challenge_method: 'S256',
    })
  })

  it('derives the web url from the API url', () => {
    expect(oauthBaseUrl()).toBe('https://github.com')
    expect(oauthBaseUrl('https://api.github.com/')).toBe('https://github.com')
    expect(oauthBaseUrl('https://ghe.example.com/api/v3')).toBe('https://ghe.example.com')
    expect(oauthBaseUrl('https://elsewhere.example.com')).toBe('https://github.com')
  })

  it('compares in constant time and handles other lengths', () => {
    expect(safeEqual('abc', 'abc')).toBe(true)
    expect(safeEqual('abc', 'abd')).toBe(false)
    expect(safeEqual('abc', 'abcd')).toBe(false)
    expect(safeEqual('', 'a')).toBe(false)
  })

  it('maps a repo permission to capabilities', () => {
    expect(mapRepoPermission({ admin: true, maintain: true, push: true })).toEqual({ permission: 'admin', capabilities: ['*'] })
    expect(mapRepoPermission({ maintain: true, push: true })).toEqual({ permission: 'maintain', capabilities: ['*'] })
    expect(mapRepoPermission({ push: true, pull: true })).toEqual({ permission: 'push', capabilities: POST_CAPS })
    expect(mapRepoPermission({ triage: true, pull: true })).toBeNull()
    expect(mapRepoPermission({ pull: true })).toBeNull()
    expect(mapRepoPermission({})).toBeNull()
    expect(mapRepoPermission(undefined)).toBeNull()
  })

  it('reads the push capabilities from the post type', () => {
    const { read, write, delete: remove } = plutoGithubPostType.capabilities!

    expect(mapRepoPermission({ push: true })!.capabilities).toEqual([read, write, remove])
  })
})

describe('isLocalRequest', () => {
  it('accepts a loopback socket with a local host', () => {
    for (const address of ['127.0.0.1', '::1', '::ffff:127.0.0.1']) {
      expect(isLocalRequest(fakeEvent({ address, headers: { host: 'localhost:3000' } }))).toBe(true)
    }
    expect(isLocalRequest(fakeEvent({ address: '127.0.0.1', headers: { host: '127.0.0.1:3000' } }))).toBe(true)
    expect(isLocalRequest(fakeEvent({ address: '::1', headers: { host: '[::1]:3000' } }))).toBe(true)
  })

  it('refuses a remote socket, whatever the headers say', () => {
    expect(isLocalRequest(fakeEvent({ address: '203.0.113.5', headers: { host: 'localhost:3000' } }))).toBe(false)
    expect(isLocalRequest(fakeEvent({ address: '203.0.113.5', headers: { 'host': 'localhost', 'x-forwarded-for': '127.0.0.1' } }))).toBe(false)
    expect(isLocalRequest(fakeEvent({ headers: { host: 'localhost' } }))).toBe(false)
  })

  it('refuses a forwarded request and a foreign host', () => {
    expect(isLocalRequest(fakeEvent({ address: '127.0.0.1', headers: { 'host': 'localhost', 'x-forwarded-for': '203.0.113.5' } }))).toBe(false)
    expect(isLocalRequest(fakeEvent({ address: '127.0.0.1', headers: { host: 'abc.ngrok.io' } }))).toBe(false)
    expect(isLocalRequest(fakeEvent({ address: '127.0.0.1', headers: { host: 'evil.test' } }))).toBe(false)
  })

  // `nuxt dev` proxies each request to its Nitro worker. The worker socket has
  // no address, and the dev proxy appends the real client as the last entry.
  it('accepts the nuxt dev worker when the proxy saw a loopback client', () => {
    expect(isLocalRequest(fakeEvent({ headers: { 'host': '127.0.0.1:3010', 'x-forwarded-for': '127.0.0.1' } }))).toBe(true)
    expect(isLocalRequest(fakeEvent({ headers: { 'host': 'localhost:3000', 'x-forwarded-for': '::1' } }))).toBe(true)
  })

  it('refuses the nuxt dev worker for a remote client, even with a spoofed header', () => {
    expect(isLocalRequest(fakeEvent({ headers: { 'host': 'localhost', 'x-forwarded-for': '192.168.0.20' } }))).toBe(false)
    // The client sent "127.0.0.1"; the dev proxy appended its real address.
    expect(isLocalRequest(fakeEvent({ headers: { 'host': 'localhost', 'x-forwarded-for': '127.0.0.1, 192.168.0.20' } }))).toBe(false)
    expect(isLocalRequest(fakeEvent({ headers: { 'host': 'abc.ngrok.io', 'x-forwarded-for': '127.0.0.1' } }))).toBe(false)
    expect(isLocalRequest(fakeEvent({ headers: { 'host': 'localhost', 'x-forwarded-for': '127.0.0.1', 'forwarded': 'for=1.2.3.4' } }))).toBe(false)
  })
})

describe('gET /api/_pluto/auth/github/login', () => {
  beforeEach(() => {
    resetTestConfig()
  })

  it('redirects to GitHub with state, PKCE and the callback url', async () => {
    const { app } = setup()

    const response = await app.request('/api/_pluto/auth/github/login?redirect=/admin/content/post')
    const url = new URL(response.location!)

    expect(response.status).toBe(302)
    expect(`${url.origin}${url.pathname}`).toBe('https://github.com/login/oauth/authorize')
    expect(url.searchParams.get('client_id')).toBe('client-id')
    expect(url.searchParams.get('redirect_uri')).toBe('http://cms.test/api/_pluto/auth/github/callback')
    expect(url.searchParams.get('code_challenge_method')).toBe('S256')
    expect(url.searchParams.get('state')).toMatch(/^[\w-]{43}$/)
    expect(url.searchParams.get('code_challenge')).toMatch(/^[\w-]{43}$/)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(app.jar.has('pluto-github-oauth')).toBe(true)
  })

  it('makes a new state and verifier each time', async () => {
    const { app } = setup()

    const first = new URL((await app.request('/api/_pluto/auth/github/login')).location!)
    const second = new URL((await app.request('/api/_pluto/auth/github/login')).location!)

    expect(first.searchParams.get('state')).not.toBe(second.searchParams.get('state'))
    expect(first.searchParams.get('code_challenge')).not.toBe(second.searchParams.get('code_challenge'))
  })

  it('seals the state cookie: httpOnly, SameSite=Lax, Secure outside dev', async () => {
    const { app } = setup()

    const response = await app.request('/api/_pluto/auth/github/login')
    const cookie = response.headers.getSetCookie().find((line) => line.startsWith('pluto-github-oauth='))!

    expect(cookie).toMatch(/HttpOnly/i)
    expect(cookie).toMatch(/SameSite=Lax/i)
    expect(cookie).toMatch(/Secure/i)
    expect(cookie).not.toContain('state')
  })

  it('does not set Secure in dev', async () => {
    const { app } = setup({ dev: true })

    const response = await app.request('/api/_pluto/auth/github/login')

    expect(response.headers.getSetCookie()[0]).not.toMatch(/Secure/i)
  })

  it('answers 500 when the client id is missing', async () => {
    const { app } = setup({ clientId: '' })
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const response = await app.request('/api/_pluto/auth/github/login')

    expect(response.status).toBe(500)
    expect(response.location).toBeNull()
    spy.mockRestore()
  })

  it('refuses to serve sign-in in production with a short session password', async () => {
    const { app } = setup({ sessionPassword: 'too-short' })
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const response = await app.request('/api/_pluto/auth/github/login')

    expect(response.status).toBe(500)
    expect((await response.json()).data.i18n.key).toBe('pluto.github.errors.authNotConfigured')
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })

  it('limits the sign-in routes to 20 requests a minute for each IP', async () => {
    const { app } = setup()
    const ip = '198.51.100.9'

    for (let index = 0; index < 20; index++) {
      expect((await app.request('/api/_pluto/auth/github/login', { ip })).status).toBe(302)
    }
    const limited = await app.request('/api/_pluto/auth/github/login', { ip })

    expect(limited.status).toBe(429)
    expect(Number(limited.headers.get('retry-after'))).toBeGreaterThan(0)
    expect((await app.request('/api/_pluto/auth/github/login', { ip: '198.51.100.10' })).status).toBe(302)
  })
})

describe('open redirect', () => {
  it.each([
    ['//evil.com'],
    ['/\\evil.com'],
    ['https://evil.com'],
    ['javascript:alert(1)'],
  ])('sends %s to the default page after sign-in', async (attack) => {
    const { app, fake } = setup()

    const { done } = await signIn(app, fake, 'ada', attack)

    expect(done.status).toBe(302)
    expect(done.location).toBe('/admin/home')
  })

  it('goes to a safe target after sign-in', async () => {
    const { app, fake } = setup()

    const { done } = await signIn(app, fake, 'ada', '/admin/content/post/new')

    expect(done.location).toBe('/admin/content/post/new')
  })
})

describe('gET /api/_pluto/auth/github/callback', () => {
  it('signs in: a session with capabilities, and no token in the response', async () => {
    const { app, fake } = setup()

    const { authorize, done } = await signIn(app, fake, 'ada')

    expect(done.status).toBe(302)
    expect(done.location).toBe('/admin/home')
    expect(app.jar.has('pluto-github-session')).toBe(true)
    expect(app.jar.has('pluto-github-oauth')).toBe(false)

    // The code is exchanged with the client secret, the verifier and the same redirect uri.
    const exchange = fake.oauth.exchanges[0]!
    expect(exchange.client_secret).toBe('client-secret')
    expect(exchange.redirect_uri).toBe('http://cms.test/api/_pluto/auth/github/callback')
    // PKCE: the verifier hashes to the challenge sent in the authorize url.
    expect(createHash('sha256').update(exchange.code_verifier!).digest('base64url')).toBe(authorize.searchParams.get('code_challenge'))

    const session = await app.request('/api/_pluto/auth/session')
    const text = await session.text()
    const body = JSON.parse(text)

    expect(body).toEqual({
      user: { id: 7, login: 'ada', name: 'Ada Lovelace', avatarUrl: 'https://avatars.example/ada.png' },
      capabilities: POST_CAPS,
      repo: { name: 'acme/site', private: true },
    })
    expect(text).not.toContain(fake.oauth.last.accessToken)
    expect(text).not.toContain(fake.oauth.last.refreshToken)
    expect(text).not.toMatch(/token/i)
    expect(session.headers.get('cache-control')).toBe('no-store')
    // The cookie holds a sealed value. It shows no token.
    expect(app.jar.get('pluto-github-session')).not.toContain(fake.oauth.last.accessToken)
  })

  it('gives admin and maintain every capability', async () => {
    for (const login of ['boss', 'lead']) {
      const { app, fake } = setup()
      await signIn(app, fake, login)

      expect((await (await app.request('/api/_pluto/auth/session')).json()).capabilities).toEqual(['*'])
    }
  })

  it('reports a public repo', async () => {
    const { app, fake } = setup({}, false)
    await signIn(app, fake, 'ada')

    expect((await (await app.request('/api/_pluto/auth/session')).json()).repo).toEqual({ name: 'acme/site', private: false })
  })

  it('rejects a state that does not match', async () => {
    const { app, fake } = setup()
    await app.request('/api/_pluto/auth/github/login')
    const code = fake.oauth.issueCode('ada')

    const response = await app.request(`/api/_pluto/auth/github/callback?code=${code}&state=wrong`)

    expect(response.location).toBe('/admin/login?error=state')
    expect(app.jar.has('pluto-github-session')).toBe(false)
    expect(fake.oauth.exchanges).toHaveLength(0)
  })

  it('rejects a callback with no state cookie, or no state', async () => {
    const { app, fake } = setup()
    const code = fake.oauth.issueCode('ada')

    expect((await app.request(`/api/_pluto/auth/github/callback?code=${code}&state=abc`)).location).toBe('/admin/login?error=state')

    await app.request('/api/_pluto/auth/github/login')
    expect((await app.request(`/api/_pluto/auth/github/callback?code=${code}`)).location).toBe('/admin/login?error=state')
  })

  it('works once: a replay of the same state fails', async () => {
    const { app, fake } = setup()
    const { authorize } = await signIn(app, fake, 'ada')
    const code = fake.oauth.issueCode('ada')

    const replay = await app.request(`/api/_pluto/auth/github/callback?code=${code}&state=${authorize.searchParams.get('state')}`)

    expect(replay.location).toBe('/admin/login?error=state')
  })

  it('sends a user with no push access to forbidden', async () => {
    const { app, fake } = setup()

    const { done } = await signIn(app, fake, 'reader')

    expect(done.location).toBe('/admin/login?error=forbidden')
    expect(app.jar.has('pluto-github-session')).toBe(false)
  })

  it('sends a user the App cannot see to not_installed', async () => {
    const { app, fake } = setup()

    const { done } = await signIn(app, fake, 'stranger')

    expect(done.location).toBe('/admin/login?error=not_installed')
    expect(app.jar.has('pluto-github-session')).toBe(false)
  })

  it('checks the allowlist, without case', async () => {
    const allowed = setup({ allowedUsers: ['ada'] })
    expect((await signIn(allowed.app, allowed.fake, 'ada')).done.location).toBe('/admin/home')

    const mixed = setup({ allowedUsers: ['ada'] })
    mixed.fake.setUser('Ada', { permission: 'push' })
    expect((await signIn(mixed.app, mixed.fake, 'Ada')).done.location).toBe('/admin/home')

    const denied = setup({ allowedUsers: ['someone-else'] })
    const { done } = await signIn(denied.app, denied.fake, 'ada')
    expect(done.location).toBe('/admin/login?error=forbidden')
    expect(denied.app.jar.has('pluto-github-session')).toBe(false)
  })

  it('goes to a generic error when GitHub refuses the code', async () => {
    const { app, fake } = setup()
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const start = await app.request('/api/_pluto/auth/github/login')
    const state = new URL(start.location!).searchParams.get('state')

    const response = await app.request(`/api/_pluto/auth/github/callback?code=unknown&state=${state}`)

    expect(response.location).toBe('/admin/login?error=github')
    expect(fake.oauth.exchanges).toHaveLength(1)
    spy.mockRestore()
  })

  it('goes to denied when the user cancels at GitHub', async () => {
    const { app } = setup()
    const start = await app.request('/api/_pluto/auth/github/login')
    const state = new URL(start.location!).searchParams.get('state')

    const response = await app.request(`/api/_pluto/auth/github/callback?error=access_denied&state=${state}`)

    expect(response.location).toBe('/admin/login?error=denied')
  })
})

describe('the session', () => {
  it('is signed out without a cookie, and sets no cookie', async () => {
    const { app } = setup()

    const response = await app.request('/api/_pluto/auth/session')

    expect(await response.json()).toEqual({ user: null })
    expect(response.headers.getSetCookie()).toEqual([])
  })

  it('treats a cookie that is not a valid session as signed out', async () => {
    const { app } = setup()
    app.jar.set('pluto-github-session', 'not-a-sealed-value')

    expect(await (await app.request('/api/_pluto/auth/session')).json()).toEqual({ user: null })
  })

  it('does not take a session from a header', async () => {
    const { app, fake } = setup()
    await signIn(app, fake, 'ada')
    const sealed = app.jar.get('pluto-github-session')!
    app.jar.clear()

    const response = await app.request('/api/_pluto/auth/session', { headers: { 'x-pluto-github-session-session': sealed, 'x-pluto-github-session': sealed } })

    expect(await response.json()).toEqual({ user: null })
  })

  it('refreshes the user token before it ends', async () => {
    const { app, fake } = setup()
    fake.oauth.expiresIn = 60
    await signIn(app, fake, 'ada')
    const first = fake.oauth.last

    const response = await app.request('/api/_pluto/auth/session')

    expect((await response.json()).user.login).toBe('ada')
    expect(fake.oauth.exchanges.at(-1)).toMatchObject({ grant_type: 'refresh_token', refresh_token: first.refreshToken })
    expect(fake.oauth.last.accessToken).not.toBe(first.accessToken)
  })

  it('refreshes once for requests that run at the same time', async () => {
    const { app, fake } = setup()
    fake.oauth.expiresIn = 60
    await signIn(app, fake, 'ada')

    const results = await Promise.all([
      app.request('/api/_pluto/auth/session'),
      app.request('/api/_pluto/auth/session'),
      app.request('/api/_pluto/auth/session'),
    ])

    expect((await Promise.all(results.map((result) => result.json()))).map((body) => body.user?.login)).toEqual(['ada', 'ada', 'ada'])
    expect(fake.oauth.exchanges.filter((body) => body.grant_type === 'refresh_token')).toHaveLength(1)
  })

  it('clears the session when the refresh fails', async () => {
    const { app, fake } = setup()
    fake.oauth.expiresIn = 60
    await signIn(app, fake, 'ada')
    fake.oauth.revokeRefreshToken(fake.oauth.last.refreshToken)

    const response = await app.request('/api/_pluto/auth/session')

    expect(await response.json()).toEqual({ user: null })
    expect(app.jar.has('pluto-github-session')).toBe(false)
  })

  it('gives a 401 to a protected route when the refresh fails', async () => {
    const { requireGithubSession } = await import('../modules/pluto-github/runtime/server/utils/session')
    const { defineEventHandler } = await import('h3')
    const { fake, app } = setup()
    const guarded = createAuthApp((router) => {
      router.get('/api/_pluto/guarded', defineEventHandler(async (event) => (await requireGithubSession(event)).user.login))
    })
    fake.oauth.expiresIn = 60
    await signIn(guarded, fake, 'ada')
    fake.oauth.revokeRefreshToken(fake.oauth.last.refreshToken)

    const response = await guarded.request('/api/_pluto/guarded')

    expect(response.status).toBe(401)
    expect(guarded.jar.has('pluto-github-session')).toBe(false)
    expect(app).toBeDefined()
  })

  it('keeps the session and answers 503 when GitHub fails during a refresh', async () => {
    const { app, fake } = setup()
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    fake.oauth.expiresIn = 60
    await signIn(app, fake, 'ada')
    fake.failNext({ status: 502, body: { message: 'Bad gateway' } })

    const response = await app.request('/api/_pluto/auth/session')

    expect(response.status).toBe(503)
    expect(app.jar.has('pluto-github-session')).toBe(true)
    spy.mockRestore()
  })

  it('checks the repo permission again after 10 minutes and revokes a lost access', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    try {
      const { app, fake } = setup()
      await signIn(app, fake, 'ada')
      fake.setUser('ada', { id: 7, permission: 'read' })

      vi.setSystemTime(Date.now() + 5 * 60_000)
      expect((await (await app.request('/api/_pluto/auth/session')).json()).user.login).toBe('ada')

      vi.setSystemTime(Date.now() + 6 * 60_000)
      const response = await app.request('/api/_pluto/auth/session')

      expect(await response.json()).toEqual({ user: null })
      expect(app.jar.has('pluto-github-session')).toBe(false)
    } finally {
      vi.useRealTimers()
    }
  })

  it('updates the capabilities when the role changes', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    try {
      const { app, fake } = setup()
      await signIn(app, fake, 'ada')
      fake.setUser('ada', { id: 7, permission: 'admin' })

      vi.setSystemTime(Date.now() + 11 * 60_000)

      expect((await (await app.request('/api/_pluto/auth/session')).json()).capabilities).toEqual(['*'])
    } finally {
      vi.useRealTimers()
    }
  })

  it('revokes the session when GitHub rejects the user token', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    try {
      const { app, fake } = setup()
      await signIn(app, fake, 'ada')
      fake.oauth.revokeToken(fake.oauth.last.accessToken)

      vi.setSystemTime(Date.now() + 11 * 60_000)

      expect(await (await app.request('/api/_pluto/auth/session')).json()).toEqual({ user: null })
      expect(app.jar.has('pluto-github-session')).toBe(false)
    } finally {
      vi.useRealTimers()
    }
  })

  it('denies this request, and keeps the session, when the check cannot run', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      const { app, fake } = setup()
      await signIn(app, fake, 'ada')
      vi.setSystemTime(Date.now() + 11 * 60_000)
      fake.failNext({ status: 502, body: { message: 'Bad gateway' } })

      expect((await app.request('/api/_pluto/auth/session')).status).toBe(503)
      expect(app.jar.has('pluto-github-session')).toBe(true)
    } finally {
      vi.useRealTimers()
      spy.mockRestore()
    }
  })

  it('logs out: clears the cookie and answers 204', async () => {
    const { app, fake } = setup()
    await signIn(app, fake, 'ada')

    const response = await app.request('/api/_pluto/auth/logout', { method: 'POST' })

    expect(response.status).toBe(204)
    expect(app.jar.has('pluto-github-session')).toBe(false)
    expect(await (await app.request('/api/_pluto/auth/session')).json()).toEqual({ user: null })
  })

  it('logs out even when the session password is missing', async () => {
    const { app } = setup({ sessionPassword: '' })

    const response = await app.request('/api/_pluto/auth/logout', { method: 'POST' })

    expect(response.status).toBe(204)
  })
})

describe('the dev fs store', () => {
  it('gives a fixed local user to a request from localhost', async () => {
    const { getGithubSession } = await import('../modules/pluto-github/runtime/server/utils/session')
    resetTestConfig(undefined, { dev: true, storage: 'fs' })

    const session = await getGithubSession(fakeEvent({ address: '127.0.0.1', headers: { host: 'localhost:3000' } }))

    expect(session).toMatchObject({ user: { login: 'local' }, capabilities: ['*'], local: true })
  })

  it('treats any other request as signed out', async () => {
    const { getGithubSession } = await import('../modules/pluto-github/runtime/server/utils/session')
    resetTestConfig(undefined, { dev: true, storage: 'fs' })

    expect(await getGithubSession(fakeEvent({ address: '203.0.113.5', headers: { host: 'localhost:3000' } }))).toBeNull()
    expect(await getGithubSession(fakeEvent({ address: '127.0.0.1', headers: { 'host': 'localhost', 'x-forwarded-for': '1.2.3.4' } }))).toBeNull()
  })

  it('does not give the local user outside dev', async () => {
    const { getGithubSession } = await import('../modules/pluto-github/runtime/server/utils/session')
    resetTestConfig(undefined, { dev: false, storage: 'fs' })

    expect(await getGithubSession(fakeEvent({ address: '127.0.0.1', headers: { host: 'localhost' } }))).toBeNull()
  })

  it('shows the local user in the session route, and not in the others', async () => {
    resetTestConfig(undefined, { dev: true, storage: 'fs' })
    const app = createAuthApp()

    // The test request has no socket address, so it is not local.
    expect(await (await app.request('/api/_pluto/auth/session')).json()).toEqual({ user: null })
  })
})

describe('requireGithubCapability', () => {
  it('answers 401 signed out, 403 without the capability, and passes with it', async () => {
    const { requireGithubCapability } = await import('../modules/pluto-github/runtime/server/utils/session')
    const { defineEventHandler } = await import('h3')
    const { fake } = setup()
    const app = createAuthApp((router) => {
      router.get('/api/_pluto/cap', defineEventHandler(async (event) => (await requireGithubCapability(event, 'posts:publish')).user.login))
      router.get('/api/_pluto/other', defineEventHandler(async (event) => (await requireGithubCapability(event, 'media:upload')).user.login))
    })

    expect((await app.request('/api/_pluto/cap')).status).toBe(401)

    await signIn(app, fake, 'ada')
    expect((await app.request('/api/_pluto/cap')).status).toBe(200)
    expect((await app.request('/api/_pluto/other')).status).toBe(403)

    const admin = createAuthApp((router) => {
      router.get('/api/_pluto/other', defineEventHandler(async (event) => (await requireGithubCapability(event, 'media:upload')).user.login))
    })
    await signIn(admin, fake, 'boss')
    expect((await admin.request('/api/_pluto/other')).status).toBe(200)
  })
})

describe('test config', () => {
  it('starts with a production style config', () => {
    resetTestConfig()

    expect(testConfig.dev).toBe(false)
  })
})

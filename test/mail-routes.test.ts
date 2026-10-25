import type { PlutoContentAdapter } from '../shared/types/content'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createApp, createRouter, defineEventHandler, toWebHandler } from 'h3'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// The mail routes are thin: each calls one function of server/mail/handlers.ts.
// This test mounts those functions in an h3 app and calls them like a browser.
// The Resend API is a fake `fetch`. No real call leaves the test.

const KEY = 're_secret_key_123'

const locales = Object.fromEntries(
  ['en', 'pt-BR'].map((code) => [
    code,
    JSON.parse(readFileSync(join(__dirname, '..', 'i18n', 'locales', `${code}.json`), 'utf8')) as Record<string, unknown>,
  ])
)

interface FetchCall {
  url: string
  method: string
  headers: Record<string, string>
  body: unknown
}

let fetchCalls: FetchCall[]
let fetchQueue: Array<Response | Error>
let config: Record<string, unknown>

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

beforeEach(() => {
  fetchCalls = []
  fetchQueue = []
  config = {
    plutoMail: { driver: '', from: 'Shop <hello@example.com>', replyTo: '', resend: { apiKey: KEY }, mailpit: { url: '' } },
    public: { websiteName: 'Acme Shop' },
  }

  vi.stubGlobal('useRuntimeConfig', () => config)
  vi.stubGlobal('fetch', async (url: string | URL | Request, init: RequestInit = {}) => {
    fetchCalls.push({
      url: String(url),
      method: String(init.method),
      headers: init.headers as Record<string, string>,
      body: typeof init.body === 'string' ? JSON.parse(init.body) : undefined,
    })
    const next = fetchQueue.shift()
    if (!next) {
      throw new Error('The fake fetch has no answer left.')
    }
    if (next instanceof Error) {
      throw next
    }
    return next
  })
  vi.doMock('#pluto-i18n-server', () => ({
    localeCodes: ['en', 'pt-BR'],
    defaultLocale: 'en',
    messageLoaders: { 'en': async () => locales.en, 'pt-BR': async () => locales['pt-BR'] },
  }))
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.doUnmock('#pluto-i18n-server')
  vi.resetModules()
  vi.restoreAllMocks()
})

type Authorize = NonNullable<PlutoContentAdapter['authorize']> | 'none' | 'no-adapter'

/**
 * A fresh module graph with the routes mounted. `'none'` registers an adapter
 * with no `authorize`. `'no-adapter'` registers no adapter.
 */
async function setup(authorize: Authorize = async () => {}) {
  const { registerContentAdapter } = await import('../server/utils/pluto-content')
  const handlers = await import('../server/mail/handlers')

  if (authorize !== 'no-adapter') {
    const adapter: PlutoContentAdapter = {
      id: 'test',
      list: async () => ({ data: [] }),
      get: async () => null,
      create: async () => ({ id: 1 }),
      update: async () => ({ id: 1 }),
      remove: async () => {},
      ...(authorize === 'none' ? {} : { authorize }),
    }
    registerContentAdapter(adapter)
  }

  const router = createRouter()
  router.get('/status', defineEventHandler(handlers.mailStatus))
  router.post('/test', defineEventHandler(handlers.mailTest))
  router.post('/resend/check-key', defineEventHandler(handlers.mailCheckKey))
  router.post('/resend/domains', defineEventHandler(handlers.mailCreateDomain))
  router.get('/resend/domains/:id', defineEventHandler(handlers.mailGetDomain))
  router.post('/resend/domains/:id/verify', defineEventHandler(handlers.mailVerifyDomain))
  router.post('/resend/sending-key', defineEventHandler(handlers.mailCreateSendingKey))
  const app = createApp()
  app.use(router)
  const handle = toWebHandler(app)

  return async function call(
    method: 'GET' | 'POST',
    path: string,
    options: {
 body?: unknown
headers?: Record<string, string>
} = {}
  ) {
    const response = await handle(new Request(`http://admin.test${path}`, {
      method,
      headers: {
        'host': 'admin.test',
        'cookie': 'session=admin-1',
        ...(options.body === undefined ? {} : { 'content-type': 'application/json' }),
        ...options.headers,
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    }))
    const text = await response.text()
    let payload: any = null
    try {
      payload = JSON.parse(text)
    } catch {
      // not JSON
    }
    return { status: response.status, headers: response.headers, text, payload }
  }
}

const routes: Array<[string, 'GET' | 'POST', string, unknown?]> = [
  ['status', 'GET', '/status'],
  ['test', 'POST', '/test', { to: 'a@example.com' }],
  ['check-key', 'POST', '/resend/check-key'],
  ['create domain', 'POST', '/resend/domains', { name: 'example.com' }],
  ['get domain', 'GET', '/resend/domains/dom_12345678'],
  ['verify domain', 'POST', '/resend/domains/dom_12345678/verify'],
  ['sending key', 'POST', '/resend/sending-key', {}],
]

describe('the admin guard (fail closed)', () => {
  for (const [name, method, path, body] of routes) {
    it(`${name}: denies when no adapter is registered`, async () => {
      const call = await setup('no-adapter')

      const response = await call(method, path, { body })

      expect(response.status).toBe(403)
      expect(response.payload.data.i18n.key).toBe('pluto.errors.forbidden')
      expect(fetchCalls).toHaveLength(0)
    })

    it(`${name}: denies when the adapter has no authorize`, async () => {
      const call = await setup('none')

      expect((await call(method, path, { body })).status).toBe(403)
      expect(fetchCalls).toHaveLength(0)
    })

    it(`${name}: denies when authorize throws`, async () => {
      const call = await setup(async () => {
        throw new Error('nope')
      })

      expect((await call(method, path, { body })).status).toBe(403)
      expect(fetchCalls).toHaveLength(0)
    })
  }

  it('asks for the star capability', async () => {
    const authorize = vi.fn(async (_event: unknown, _capability: string) => {})
    const call = await setup(authorize)

    await call('GET', '/status')

    expect(authorize).toHaveBeenCalledTimes(1)
    expect(authorize.mock.calls[0]![1]).toBe('*')
  })

  it('keeps a 401 from the adapter', async () => {
    const call = await setup(async () => {
      throw Object.assign(new Error('Unauthorized'), { statusCode: 401 })
    })

    expect((await call('GET', '/status')).status).toBe(401)
  })

  it('denies a cross-site POST, and lets a same-origin POST through', async () => {
    const call = await setup()

    const crossOrigin = await call('POST', '/resend/check-key', { headers: { origin: 'https://evil.test' } })
    const crossSite = await call('POST', '/resend/check-key', { headers: { 'sec-fetch-site': 'cross-site' } })
    fetchQueue.push(json({ data: [] }))
    const sameOrigin = await call('POST', '/resend/check-key', { headers: { origin: 'http://admin.test' } })

    expect(crossOrigin.status).toBe(403)
    expect(crossSite.status).toBe(403)
    expect(sameOrigin.status).toBe(200)
  })
})

describe('status', () => {
  it('returns the status and no secret', async () => {
    const call = await setup()

    const response = await call('GET', '/status')

    expect(response.status).toBe(200)
    expect(response.payload).toMatchObject({
      driver: 'resend',
      configured: true,
      source: 'key',
      hasKey: true,
      from: 'Shop <hello@example.com>',
    })
    expect(response.text).not.toContain(KEY)
  })

  it('falls back to the dev driver with no key (the test run is a dev run)', async () => {
    ;(config.plutoMail as Record<string, unknown>).resend = { apiKey: '' }
    const call = await setup()

    const response = await call('GET', '/status')

    expect(response.payload).toMatchObject({ driver: 'dev', hasKey: false })
  })
})

describe('test email', () => {
  it('sends the test email to the address', async () => {
    const call = await setup()
    fetchQueue.push(json({ id: 'msg_1' }))

    const response = await call('POST', '/test', { body: { to: 'ana@example.com' } })

    expect(response.status).toBe(200)
    expect(response.payload).toEqual({ ok: true, id: 'msg_1', driver: 'resend' })
    expect(fetchCalls).toHaveLength(1)
    expect(fetchCalls[0]!.url).toBe('https://api.resend.com/emails')
    expect(fetchCalls[0]!.body).toMatchObject({
      from: 'Shop <hello@example.com>',
      to: ['ana@example.com'],
      subject: 'Test email from Acme Shop',
    })
    expect(String((fetchCalls[0]!.body as {
 text: string
}).text)).toContain('Acme Shop')
  })

  it('writes the email in the locale of the request', async () => {
    const call = await setup()
    fetchQueue.push(json({ id: 'msg_1' }))

    await call('POST', '/test', { body: { to: 'ana@example.com', locale: 'pt-BR' } })

    expect((fetchCalls[0]!.body as {
 subject: string
}).subject).toBe('E-mail de teste de Acme Shop')
  })

  it('rejects an invalid address without a call', async () => {
    const call = await setup()

    // Each call has its own session, so the 5-per-10-minutes limit does not apply.
    let session = 0
    for (const to of ['', 'nope', 'a@b', 'a b@c.com', 'a@b.com, c@d.com', 42]) {
      const response = await call('POST', '/test', { body: { to }, headers: { cookie: `session=probe-${session++}` } })
      expect(response.status).toBe(400)
      expect(response.payload.data.i18n.key).toBe('pluto.mail.errors.invalidEmail')
    }
    expect((await call('POST', '/test', { headers: { cookie: 'session=probe-x' } })).status).toBe(400)
    expect(fetchCalls).toHaveLength(0)
  })

  it('explains the test sender rule (403 from Resend)', async () => {
    const call = await setup()
    fetchQueue.push(json({ name: 'validation_error', message: 'You can only send testing emails to your own email address (owner@secret.test).' }, 403))

    const response = await call('POST', '/test', { body: { to: 'ana@example.com' } })

    expect(response.status).toBe(400)
    expect(response.payload.data.i18n.key).toBe('pluto.mail.errors.test_sender_only')
    expect(response.payload.data.mail.code).toBe('test_sender_only')
    expect(response.text).not.toContain('owner@secret.test')
  })

  it('answers 409 not_configured when no driver can send', async () => {
    config.plutoMail = { ...(config.plutoMail as object), driver: 'none', resend: { apiKey: '' } }
    const call = await setup()

    const response = await call('POST', '/test', { body: { to: 'ana@example.com' } })

    expect(response.status).toBe(409)
    expect(response.payload.data.mail.code).toBe('not_configured')
  })

  it('limits each admin to 5 test emails in 10 minutes', async () => {
    const call = await setup()
    fetchQueue.push(...Array.from({ length: 6 }, () => json({ id: 'm' })))

    const statuses: number[] = []
    for (let i = 0; i < 6; i++) {
      statuses.push((await call('POST', '/test', { body: { to: 'ana@example.com' } })).status)
    }
    const other = await call('POST', '/test', { body: { to: 'ana@example.com' }, headers: { cookie: 'session=admin-2' } })

    expect(statuses).toEqual([200, 200, 200, 200, 200, 429])
    expect(other.status).toBe(200)
  })

  it('sets Retry-After and a key for the message on the limit', async () => {
    const call = await setup()
    fetchQueue.push(...Array.from({ length: 5 }, () => json({ id: 'm' })))
    for (let i = 0; i < 5; i++) {
      await call('POST', '/test', { body: { to: 'ana@example.com' } })
    }

    const response = await call('POST', '/test', { body: { to: 'ana@example.com' } })

    expect(Number(response.headers.get('retry-after'))).toBeGreaterThan(0)
    expect(response.payload.data.i18n.key).toBe('pluto.mail.errors.testRateLimited')
  })

  it('counts a rejected address toward the limit too (no free probing)', async () => {
    const call = await setup()

    const statuses: number[] = []
    for (let i = 0; i < 6; i++) {
      statuses.push((await call('POST', '/test', { body: { to: 'bad' } })).status)
    }

    expect(statuses).toEqual([400, 400, 400, 400, 400, 429])
  })
})

describe('check key', () => {
  it('reports full access and lists the domains', async () => {
    const call = await setup()
    fetchQueue.push(json({ data: [{ id: 'dom_12345678', name: 'example.com', status: 'verified', region: 'us-east-1', created_at: 'x' }] }))

    const response = await call('POST', '/resend/check-key')

    expect(response.status).toBe(200)
    expect(response.payload).toEqual({
      access: 'full',
      domains: [{ id: 'dom_12345678', name: 'example.com', status: 'verified', region: 'us-east-1', records: [] }],
    })
    expect(fetchCalls[0]!.url).toBe('https://api.resend.com/domains')
    expect(response.text).not.toContain(KEY)
  })

  it('reports a sending-only key', async () => {
    const call = await setup()
    fetchQueue.push(json({ name: 'restricted_api_key', message: 'This API key is restricted to only send emails' }, 401))

    const response = await call('POST', '/resend/check-key')

    expect(response.status).toBe(200)
    expect(response.payload).toEqual({ access: 'sending', domains: [] })
  })

  it('reports an invalid key as 400 invalid_key', async () => {
    const call = await setup()
    fetchQueue.push(json({ name: 'invalid_api_key', message: 'API key is invalid' }, 401))

    const response = await call('POST', '/resend/check-key')

    expect(response.status).toBe(400)
    expect(response.payload.data.mail.code).toBe('invalid_key')
  })

  it('answers 409 when no key is set', async () => {
    config.plutoMail = { ...(config.plutoMail as object), resend: { apiKey: '' } }
    const call = await setup()

    const response = await call('POST', '/resend/check-key')

    expect(response.status).toBe(409)
    expect(fetchCalls).toHaveLength(0)
  })
})

describe('domains', () => {
  const created = {
    id: 'dom_12345678',
    name: 'example.com',
    status: 'not_started',
    region: 'sa-east-1',
    created_at: '2026-10-25',
    records: [
      { record: 'SPF', name: 'send', type: 'MX', ttl: 'Auto', status: 'not_started', value: 'feedback-smtp.sa-east-1.amazonses.com', priority: 10 },
      { record: 'DKIM', name: 'resend._domainkey', type: 'TXT', ttl: 'Auto', status: 'not_started', value: 'p=MIGfMA0', extra: 'dropped' },
    ],
  }

  it('creates a domain and returns the records', async () => {
    const call = await setup()
    fetchQueue.push(json(created, 201))

    const response = await call('POST', '/resend/domains', { body: { name: ' Example.COM ', region: 'sa-east-1' } })

    expect(response.status).toBe(200)
    expect(fetchCalls[0]).toMatchObject({ url: 'https://api.resend.com/domains', method: 'POST', body: { name: 'example.com', region: 'sa-east-1' } })
    expect(response.payload.records).toEqual([
      { record: 'SPF', name: 'send', type: 'MX', value: 'feedback-smtp.sa-east-1.amazonses.com', ttl: 'Auto', status: 'not_started', priority: 10 },
      { record: 'DKIM', name: 'resend._domainkey', type: 'TXT', value: 'p=MIGfMA0', ttl: 'Auto', status: 'not_started', priority: null },
    ])
    expect(response.payload.region).toBe('sa-east-1')
  })

  it('uses us-east-1 when the body has no region', async () => {
    const call = await setup()
    fetchQueue.push(json(created))

    await call('POST', '/resend/domains', { body: { name: 'example.com' } })

    expect(fetchCalls[0]!.body).toEqual({ name: 'example.com', region: 'us-east-1' })
  })

  it('rejects a bad domain name or region without a call', async () => {
    const call = await setup()

    for (const name of ['', 'example', 'exa mple.com', 'https://example.com', 'example.com/path', '-a.com', 'a..com', 'a.c', 'a.com:80']) {
      const response = await call('POST', '/resend/domains', { body: { name } })
      expect(response.status, name).toBe(400)
      expect(response.payload.data.i18n.key).toBe('pluto.mail.errors.invalidDomain')
    }
    const region = await call('POST', '/resend/domains', { body: { name: 'example.com', region: 'mars-1' } })
    expect(region.payload.data.i18n.key).toBe('pluto.mail.errors.invalidRegion')
    expect(fetchCalls).toHaveLength(0)
  })

  it('maps a restricted key to restricted_key', async () => {
    const call = await setup()
    fetchQueue.push(json({ name: 'restricted_api_key' }, 401))

    const response = await call('POST', '/resend/domains', { body: { name: 'example.com' } })

    expect(response.status).toBe(400)
    expect(response.payload.data.mail.code).toBe('restricted_key')
  })

  it('reads a domain', async () => {
    const call = await setup()
    fetchQueue.push(json({ ...created, status: 'verified' }))

    const response = await call('GET', '/resend/domains/dom_12345678')

    expect(response.status).toBe(200)
    expect(response.payload.status).toBe('verified')
    expect(fetchCalls[0]).toMatchObject({ url: 'https://api.resend.com/domains/dom_12345678', method: 'GET' })
  })

  it('rejects a domain id that could change the path', async () => {
    const call = await setup()

    for (const id of ['x', 'a%2Fb%2Fc%2Fd%2Fe', 'dom_1234..5678', 'dom 12345678']) {
      expect((await call('GET', `/resend/domains/${id}`)).status, id).toBe(400)
    }
    expect(fetchCalls).toHaveLength(0)
  })

  it('verifies a domain', async () => {
    const call = await setup()
    fetchQueue.push(json({ object: 'domain', id: 'dom_12345678' }))

    const response = await call('POST', '/resend/domains/dom_12345678/verify')

    expect(response.payload).toEqual({ ok: true })
    expect(fetchCalls[0]).toMatchObject({ url: 'https://api.resend.com/domains/dom_12345678/verify', method: 'POST' })
  })
})

describe('sending key', () => {
  it('makes a sending-only key for a domain and shows it once', async () => {
    const call = await setup()
    fetchQueue.push(json({ id: 'key_1', token: 're_new_sending_token' }, 201))

    const response = await call('POST', '/resend/sending-key', { body: { domainId: 'dom_12345678' } })

    expect(response.status).toBe(200)
    expect(response.payload).toEqual({ token: 're_new_sending_token' })
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(fetchCalls[0]).toMatchObject({
      url: 'https://api.resend.com/api-keys',
      body: { name: 'Pluto sending key', permission: 'sending_access', domain_id: 'dom_12345678' },
    })
    expect(response.text).not.toContain(KEY)
  })

  it('works with no domain', async () => {
    const call = await setup()
    fetchQueue.push(json({ id: 'key_1', token: 're_new' }))

    await call('POST', '/resend/sending-key', { body: {} })

    expect(fetchCalls[0]!.body).toEqual({ name: 'Pluto sending key', permission: 'sending_access' })
  })

  it('rejects a bad domain id', async () => {
    const call = await setup()

    expect((await call('POST', '/resend/sending-key', { body: { domainId: '../x' } })).status).toBe(400)
    expect(fetchCalls).toHaveLength(0)
  })

  it('needs a full-access key', async () => {
    const call = await setup()
    fetchQueue.push(json({ name: 'restricted_api_key' }, 401))

    const response = await call('POST', '/resend/sending-key', { body: {} })

    expect(response.status).toBe(400)
    expect(response.payload.data.mail.code).toBe('restricted_key')
  })

  it('fails when Resend returns no token', async () => {
    const call = await setup()
    fetchQueue.push(json({ id: 'key_1' }))

    expect((await call('POST', '/resend/sending-key', { body: {} })).status).toBe(502)
  })
})

describe('logs', () => {
  it('writes no recipient, subject, link or key to the console', async () => {
    const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((name) => vi.spyOn(console, name).mockImplementation(() => {}))
    const call = await setup()
    fetchQueue.push(json({ id: 'm' }), json({ name: 'invalid_api_key' }, 401), json({ name: 'rate_limit_exceeded' }, 429), json({ name: 'rate_limit_exceeded' }, 429))

    await call('POST', '/test', { body: { to: 'ana@example.com' } })
    await call('POST', '/resend/check-key')
    await call('POST', '/test', { body: { to: 'ana@example.com' } })
    await call('POST', '/resend/domains', { body: { name: 'example.com' } })

    for (const spy of spies) {
      expect(spy).not.toHaveBeenCalled()
    }
  })
})

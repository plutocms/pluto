import type { GithubFetch } from '../modules/pluto-cms/runtime/server/github/client'
import { Buffer } from 'node:buffer'
import { generateKeyPairSync } from 'node:crypto'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import callbackRoute from '../modules/pluto-cms/runtime/server/api/setup/github/callback.get'
import startRoute from '../modules/pluto-cms/runtime/server/api/setup/github/start.get'
import statusRoute from '../modules/pluto-cms/runtime/server/api/setup/status.get'
import { createAuthApp, resetTestConfig, signIn } from './fixtures/cms-auth-harness'
import { createFakeGithub } from './fixtures/fake-github'

vi.mock('../modules/pluto-cms/runtime/server/utils/cms-config', async () => {
  const { testConfig } = await import('./fixtures/cms-test-config')
  return { getCmsConfig: () => testConfig }
})

// The real locale files, with a translator that fails on a missing key.
vi.mock('../server/utils/pluto-i18n', async () => {
  const { readFileSync } = await import('node:fs')
  const { join } = await import('node:path')
  const { createTranslator, flattenMessages } = await import('../app/composables/internal/i18n-core')
  const load = (code: string) => flattenMessages(JSON.parse(readFileSync(join(__dirname, '..', 'i18n', 'locales', `${code}.json`), 'utf8')))
  const messages: Record<string, ReturnType<typeof load>> = { 'en': load('en'), 'pt-BR': load('pt-BR') }
  return {
    usePlutoServerTranslator: async (locale?: string) => {
      const code = locale?.toLowerCase().startsWith('pt') ? 'pt-BR' : 'en'
      const translator = createTranslator({
        locale: () => code,
        fallbackLocale: 'en',
        messages: (name) => messages[name],
        warn: (message) => {
          throw new Error(message)
        },
      })
      return { ...translator, locale: code }
    },
  }
})

const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
})

const CONVERSION = {
  id: 4242,
  slug: 'acme-cms',
  name: 'Acme CMS',
  client_id: 'Iv1.setupclient',
  client_secret: 'setup-client-secret-value',
  pem: privateKey,
  html_url: 'https://github.com/apps/acme-cms',
}

const LOCAL = { ip: '127.0.0.1', headers: { host: 'localhost:3000' } }

interface Call {
  method: string
  url: string
  headers: Record<string, string>
  body?: string
}

/** A GitHub that answers the three calls of the setup. */
function createSetupGithub(options: {
 ownerType?: string
installed?: boolean
conversion?: 'ok' | 'fail' | 'bad'
} = {}) {
  const calls: Call[] = []
  const fetch: GithubFetch = async (url, init) => {
    calls.push({ method: init.method, url, headers: init.headers, body: init.body })
    const respond = (status: number, data: unknown) => ({ status, headers: { get: () => null }, data })
    const path = new URL(url).pathname
    if (path.includes('/users/')) {
      return respond(200, { type: options.ownerType ?? 'Organization' })
    }
    if (path.endsWith('/conversions')) {
      if (options.conversion === 'fail') {
        return respond(404, { message: 'Not Found: GitHub-secret-detail' })
      }
      return respond(201, options.conversion === 'bad' ? { id: 1 } : CONVERSION)
    }
    if (path.endsWith('/installation')) {
      return options.installed === false ? respond(404, { message: 'Not Found' }) : respond(200, { id: 9 })
    }
    return respond(500, {})
  }
  return { fetch, calls }
}

function setupApp() {
  return createAuthApp((router) => {
    router.get('/api/_pluto/cms/setup/status', statusRoute)
    router.get('/api/_pluto/cms/setup/github/start', startRoute)
    router.get('/api/_pluto/cms/setup/github/callback', callbackRoute)
  })
}

const CONFIGURED = {
  appId: '1',
  clientId: 'cid',
  clientSecret: 'configured-secret',
  privateKey,
}

function configure(patch: Parameters<typeof resetTestConfig>[1], github = createSetupGithub()) {
  resetTestConfig(undefined, { fetch: github.fetch, ...patch })
  return github
}

/** Runs `start` and returns the state from the form action. */
async function startFlow(app: ReturnType<typeof setupApp>, init: Parameters<ReturnType<typeof setupApp>['request']>[1] = {}) {
  const response = await app.request('/api/_pluto/cms/setup/github/start', init)
  const html = await response.text()
  const action = /<form[^>]*action="([^"]+)"/.exec(html)?.[1]?.replaceAll('&amp;', '&')
  const state = action ? new URL(action).searchParams.get('state') : null
  return { response, html, action, state }
}

let tmp: string

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'pluto-setup-'))
})

afterEach(() => {
  rmSync(tmp, { recursive: true, force: true })
  vi.restoreAllMocks()
})

describe('the status route', () => {
  it('tells an anonymous caller only that a ready site is ready', async () => {
    configure({ ...CONFIGURED })
    const response = await setupApp().request('/api/_pluto/cms/setup/status')

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ready: true })
    expect(response.headers.get('cache-control')).toBe('no-store')
  })

  it('gives the checks while the sign-in is not set up, with no secret', async () => {
    configure({ ...CONFIGURED, appId: '', clientSecret: 'must-not-leak', sessionPassword: 'short' })
    const response = await setupApp().request('/api/_pluto/cms/setup/status')
    const text = await response.text()
    const body = JSON.parse(text)

    expect(body).toMatchObject({
      ready: false,
      repo: 'acme/site',
      storage: 'github',
      canCreateApp: true,
      callbackUrl: 'http://cms.test/api/_pluto/auth/github/callback',
    })
    expect(body.checks).toEqual([
      { id: 'repo', ok: true },
      { id: 'sessionPassword', ok: false },
      { id: 'appId', ok: false },
      { id: 'clientId', ok: true },
      { id: 'clientSecret', ok: true },
      { id: 'privateKey', ok: true },
    ])
    expect(text).not.toContain('must-not-leak')
    expect(text).not.toContain('BEGIN')
  })

  it('checks the installation when the app id and the key are fine', async () => {
    const github = configure({ ...CONFIGURED, clientSecret: '' }, createSetupGithub({ installed: false }))
    const body = await (await setupApp().request('/api/_pluto/cms/setup/status')).json()

    expect(body.checks.at(-1)).toEqual({ id: 'installation', ok: false })
    const call = github.calls.find((entry) => entry.url.endsWith('/repos/acme/site/installation'))
    expect(call?.headers.Authorization).toMatch(/^Bearer [\w-]+\.[\w-]+\.[\w-]+$/)
  })

  it('reports an installed App', async () => {
    configure({ ...CONFIGURED, clientSecret: '' })
    const body = await (await setupApp().request('/api/_pluto/cms/setup/status')).json()

    expect(body.checks.at(-1)).toEqual({ id: 'installation', ok: true })
  })

  it('skips the installation check when the key is bad', async () => {
    const github = configure({ ...CONFIGURED, privateKey: 'garbage' })
    const body = await (await setupApp().request('/api/_pluto/cms/setup/status')).json()

    expect(body.checks.some((check: {
 id: string
}) => check.id === 'installation')).toBe(false)
    expect(github.calls).toHaveLength(0)
  })

  it('gives the checks to the dev local request even when ready', async () => {
    const github = configure({ ...CONFIGURED, dev: true })
    const body = await (await setupApp().request('/api/_pluto/cms/setup/status', LOCAL)).json()

    expect(body.ready).toBe(true)
    expect(body.canCreateApp).toBe(true)
    expect(body.checks.at(-1)).toEqual({ id: 'installation', ok: true })
    expect(github.calls.length).toBeGreaterThan(0)
  })

  it('does not trust a request that only looks local in production', async () => {
    configure({ ...CONFIGURED, dev: false })

    expect(await (await setupApp().request('/api/_pluto/cms/setup/status', LOCAL)).json()).toEqual({ ready: true })
  })

  it('gives the checks to the dev fs user of a ready site', async () => {
    // The dev fs store signs the local request in.
    configure({ ...CONFIGURED, dev: true, storage: 'fs' })
    const body = await (await setupApp().request('/api/_pluto/cms/setup/status', LOCAL)).json()

    expect(body.checks).toBeDefined()
    expect(body.storage).toBe('fs')
  })

  it('gives the checks to a signed-in user of a ready site', async () => {
    const fake = createFakeGithub({
      users: { ada: { id: 7, permission: 'push' } },
      app: { id: '1', installationId: 99, publicKey },
    })
    resetTestConfig(fake, { ...CONFIGURED, clientId: 'client-id', clientSecret: 'client-secret' })
    const app = setupApp()

    expect(await (await app.request('/api/_pluto/cms/setup/status')).json()).toEqual({ ready: true })
    await signIn(app, fake, 'ada')
    const body = await (await app.request('/api/_pluto/cms/setup/status')).json()

    expect(body.ready).toBe(true)
    expect(body.canCreateApp).toBe(false)
    expect(body.checks.at(-1)).toEqual({ id: 'installation', ok: true })
  })

  it('uses the forwarded host and protocol for the callback URL', async () => {
    configure({ ...CONFIGURED, appId: '' })
    const body = await (await setupApp().request('/api/_pluto/cms/setup/status', {
      headers: { 'x-forwarded-host': 'acme.com', 'x-forwarded-proto': 'https' },
    })).json()

    expect(body.callbackUrl).toBe('https://acme.com/api/_pluto/auth/github/callback')
  })
})

describe('the start route', () => {
  it('answers 404 when the sign-in is set up', async () => {
    const github = configure({ ...CONFIGURED })
    const response = await setupApp().request('/api/_pluto/cms/setup/github/start')

    expect(response.status).toBe(404)
    expect(response.headers.get('set-cookie')).toBeNull()
    expect(github.calls).toHaveLength(0)
  })

  it('renders a form that posts the manifest to the organization page', async () => {
    const github = configure({ ...CONFIGURED, appId: '' })
    const { response, html, action, state } = await startFlow(setupApp(), { headers: { 'x-forwarded-host': 'acme.com', 'x-forwarded-proto': 'https' } })

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('text/html')
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(action).toMatch(/^https:\/\/github\.com\/organizations\/acme\/settings\/apps\/new\?state=/)
    expect(state).toMatch(/^[\w-]{20,}$/)
    expect(html).toContain('method="post"')
    expect(html).toContain('type="submit"')
    expect(github.calls[0]!.url).toBe('https://api.github.com/users/acme')

    const manifest = JSON.parse(/name="manifest" value="([^"]+)"/.exec(html)![1]!.replaceAll('&quot;', '"').replaceAll('&amp;', '&'))
    expect(manifest).toMatchObject({
      name: 'Acme CMS',
      url: 'https://acme.com',
      redirect_url: 'https://acme.com/api/_pluto/cms/setup/github/callback',
      callback_urls: [
        'https://acme.com/api/_pluto/auth/github/callback',
        'http://localhost:3000/api/_pluto/auth/github/callback',
      ],
      public: false,
      default_permissions: { contents: 'write', metadata: 'read', checks: 'read', statuses: 'read', deployments: 'read' },
      hook_attributes: { url: 'https://acme.com', active: false },
      default_events: [],
      request_oauth_on_install: false,
    })
  })

  it('sets a plain state cookie, not a sealed session', async () => {
    configure({ ...CONFIGURED, appId: '' })
    const { response, state } = await startFlow(setupApp())
    const cookie = response.headers.getSetCookie().find((line) => line.startsWith('pluto-cms-setup='))!

    expect(cookie).toBeDefined()
    expect(cookie).toContain(`pluto-cms-setup=${state}`)
    expect(cookie).toMatch(/HttpOnly/i)
    expect(cookie).toMatch(/SameSite=Lax/i)
    expect(cookie).toMatch(/Max-Age=600/i)
    expect(cookie).toContain('Path=/api/_pluto/cms/setup')
    expect(response.headers.getSetCookie().some((line) => line.startsWith('pluto-cms-session'))).toBe(false)
  })

  it('works without a session password', async () => {
    configure({ appId: '', clientId: '', clientSecret: '', privateKey: '', sessionPassword: '' })
    const { response } = await startFlow(setupApp())

    expect(response.status).toBe(200)
  })

  it('uses the personal page for a user owner', async () => {
    configure({ appId: '' }, createSetupGithub({ ownerType: 'User' }))
    const { action } = await startFlow(setupApp())

    expect(action).toMatch(/^https:\/\/github\.com\/settings\/apps\/new\?state=/)
  })

  it('uses the host of GitHub Enterprise', async () => {
    const github = configure({ appId: '', apiUrl: 'https://ghe.example.com/api/v3' })
    const { action } = await startFlow(setupApp())

    expect(action).toMatch(/^https:\/\/ghe\.example\.com\/organizations\/acme\/settings\/apps\/new\?state=/)
    expect(github.calls[0]!.url).toBe('https://ghe.example.com/api/v3/users/acme')
  })

  it('runs for the dev local request even when ready', async () => {
    configure({ ...CONFIGURED, dev: true })
    const { response } = await startFlow(setupApp(), LOCAL)

    expect(response.status).toBe(200)
  })

  it('translates the page', async () => {
    configure({ appId: '' })
    const { html } = await startFlow(setupApp(), { headers: { 'accept-language': 'pt-BR,pt;q=0.9' } })

    expect(html).toContain('lang="pt-BR"')
    expect(html).toContain('Continuar no GitHub')
  })
})

describe('the callback route', () => {
  async function run(app: ReturnType<typeof setupApp>, init: Parameters<ReturnType<typeof setupApp>['request']>[1] = {}, code = 'abc123') {
    const { state } = await startFlow(app, init)
    const response = await app.request(`/api/_pluto/cms/setup/github/callback?code=${code}&state=${state}`, init)
    return { response, html: await response.text(), state }
  }

  function envLines(html: string): Record<string, string> {
    const block = /<textarea[^>]*>([\s\S]*?)<\/textarea>/.exec(html)![1]!
    return Object.fromEntries(block.trim().split('\n').map((line) => {
      const index = line.indexOf('=')
      return [line.slice(0, index), line.slice(index + 1)]
    }))
  }

  it('trades the code and shows the env block, the install link and the next steps', async () => {
    const github = configure({ appId: '', sessionPassword: '' })
    const { response, html } = await run(setupApp())

    expect(response.status).toBe(200)
    const env = envLines(html)
    expect(Object.keys(env)).toEqual([
      'NUXT_PLUTO_CMS_GITHUB_APP_ID',
      'NUXT_PLUTO_CMS_GITHUB_CLIENT_ID',
      'NUXT_PLUTO_CMS_GITHUB_CLIENT_SECRET',
      'NUXT_PLUTO_CMS_GITHUB_PRIVATE_KEY',
      'PLUTO_CMS_APP_SLUG',
      'NUXT_PLUTO_CMS_SESSION_PASSWORD',
    ])
    expect(env.NUXT_PLUTO_CMS_GITHUB_APP_ID).toBe('4242')
    expect(env.NUXT_PLUTO_CMS_GITHUB_CLIENT_SECRET).toBe('setup-client-secret-value')
    expect(Buffer.from(env.NUXT_PLUTO_CMS_GITHUB_PRIVATE_KEY!, 'base64').toString('utf8')).toBe(privateKey.trim())
    expect(env.NUXT_PLUTO_CMS_SESSION_PASSWORD!.length).toBeGreaterThanOrEqual(32)
    expect(html).toContain('https://github.com/apps/acme-cms/installations/new')
    expect(html).toContain('id="copy"')
    expect(html).toContain('prefers-color-scheme:dark')
    expect(html).toContain('Vercel')
    expect(response.headers.get('cache-control')).toBe('no-store')

    const conversion = github.calls.find((call) => call.url.endsWith('/app-manifests/abc123/conversions'))!
    expect(conversion.method).toBe('POST')
    expect(conversion.headers.Authorization).toBeUndefined()
  })

  it('leaves out the session password when the site has one', async () => {
    configure({ appId: '' })
    const { html } = await run(setupApp())

    expect(Object.keys(envLines(html))).not.toContain('NUXT_PLUTO_CMS_SESSION_PASSWORD')
  })

  it('makes a new session password when the old one is short', async () => {
    configure({ appId: '', sessionPassword: 'short' })
    const { html } = await run(setupApp())

    expect(Object.keys(envLines(html))).toContain('NUXT_PLUTO_CMS_SESSION_PASSWORD')
  })

  it('translates the result page', async () => {
    configure({ appId: '' })
    const { html } = await run(setupApp(), { headers: { 'accept-language': 'pt-BR' } })

    expect(html).toContain('O GitHub App foi criado')
  })

  it('rejects a wrong state and does not call GitHub', async () => {
    const github = configure({ appId: '' })
    const app = setupApp()
    await startFlow(app)
    github.calls.length = 0
    const response = await app.request('/api/_pluto/cms/setup/github/callback?code=abc&state=wrong')

    expect(response.status).toBe(400)
    expect(await response.text()).toContain('/api/_pluto/cms/setup/github/start')
    expect(github.calls).toHaveLength(0)
  })

  it('rejects a callback with no state cookie', async () => {
    const github = configure({ appId: '' })
    const response = await setupApp().request('/api/_pluto/cms/setup/github/callback?code=abc&state=anything')

    expect(response.status).toBe(400)
    expect(github.calls).toHaveLength(0)
  })

  it('uses the state once', async () => {
    const github = configure({ appId: '' })
    const app = setupApp()
    const { state } = await startFlow(app)
    const url = `/api/_pluto/cms/setup/github/callback?code=abc&state=${state}`

    expect((await app.request(url)).status).toBe(200)
    expect(app.deleted).toContain('pluto-cms-setup')
    github.calls.length = 0
    expect((await app.request(url)).status).toBe(400)
    expect(github.calls).toHaveLength(0)
  })

  it('rejects a code with a strange shape', async () => {
    const github = configure({ appId: '' })
    const app = setupApp()
    const { state } = await startFlow(app)
    github.calls.length = 0
    const response = await app.request(`/api/_pluto/cms/setup/github/callback?code=${encodeURIComponent('../x?y')}&state=${state}`)

    expect(response.status).toBe(400)
    expect(github.calls).toHaveLength(0)
  })

  it('answers 404 when the sign-in is set up', async () => {
    configure({ ...CONFIGURED })
    const response = await setupApp().request('/api/_pluto/cms/setup/github/callback?code=abc&state=x')

    expect(response.status).toBe(404)
  })

  it('shows an error page and no GitHub text when the conversion fails', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    configure({ appId: '' }, createSetupGithub({ conversion: 'fail' }))
    const { response, html } = await run(setupApp())

    expect(response.status).toBe(502)
    expect(html).toContain('/api/_pluto/cms/setup/github/start')
    expect(html).not.toContain('GitHub-secret-detail')
    expect(html).not.toContain('<textarea')
    expect(JSON.stringify(error.mock.calls)).not.toContain('GitHub-secret-detail')
  })

  it('shows an error page when GitHub answers without the fields', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    configure({ appId: '' }, createSetupGithub({ conversion: 'bad' }))
    const { response } = await run(setupApp())

    expect(response.status).toBe(502)
  })

  it('never logs a secret', async () => {
    const spies = [vi.spyOn(console, 'log'), vi.spyOn(console, 'info'), vi.spyOn(console, 'warn'), vi.spyOn(console, 'error')]
    configure({ appId: '' })
    await run(setupApp())

    const logged = JSON.stringify(spies.flatMap((spy) => spy.mock.calls))
    expect(logged).not.toContain('setup-client-secret-value')
    expect(logged).not.toContain('BEGIN')
  })

  describe('in development', () => {
    it('writes .env and keeps the other lines', async () => {
      configure({ appId: '', dev: true, rootDir: tmp, sessionPassword: '' })
      writeFileSync(join(tmp, '.env'), '# my site\nPLUTO_CMS_REPO=acme/site\nNUXT_PLUTO_CMS_GITHUB_APP_ID=old\nOTHER=1\n')
      writeFileSync(join(tmp, '.gitignore'), 'node_modules\n.env\n')
      const { response, html } = await run(setupApp(), LOCAL)
      const file = readFileSync(join(tmp, '.env'), 'utf8')
      const lines = file.trim().split('\n')

      expect(response.status).toBe(200)
      expect(lines.slice(0, 4)).toEqual(['# my site', 'PLUTO_CMS_REPO=acme/site', 'NUXT_PLUTO_CMS_GITHUB_APP_ID=4242', 'OTHER=1'])
      expect(file).toContain('NUXT_PLUTO_CMS_GITHUB_CLIENT_SECRET=setup-client-secret-value')
      expect(file).toContain('NUXT_PLUTO_CMS_SESSION_PASSWORD=')
      expect(file).toContain('PLUTO_CMS_APP_SLUG=acme-cms')
      expect(html).toContain('saved in the .env file')
      expect(html).not.toContain('could not write')
      expect(html).not.toContain('does not ignore')
    })

    it('creates .env when it does not exist, and warns when .gitignore does not ignore it', async () => {
      configure({ appId: '', dev: true, rootDir: tmp })
      const { html } = await run(setupApp(), LOCAL)

      expect(readFileSync(join(tmp, '.env'), 'utf8')).toContain('NUXT_PLUTO_CMS_GITHUB_APP_ID=4242')
      expect(html).toContain('does not ignore')
    })

    it('still shows the block when it cannot write the file', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {})
      configure({ appId: '', dev: true, rootDir: join(tmp, 'missing', 'dir') })
      const { response, html } = await run(setupApp(), LOCAL)

      expect(response.status).toBe(200)
      expect(html).toContain('could not write')
      expect(html).toContain('NUXT_PLUTO_CMS_GITHUB_APP_ID=4242')
    })

    it('does not write .env for a request that is not local', async () => {
      configure({ appId: '', dev: true, rootDir: tmp })
      await run(setupApp())

      expect(() => readFileSync(join(tmp, '.env'), 'utf8')).toThrow()
    })

    it('does not write .env in production', async () => {
      configure({ appId: '', dev: false, rootDir: tmp })
      await run(setupApp(), LOCAL)

      expect(() => readFileSync(join(tmp, '.env'), 'utf8')).toThrow()
    })
  })
})

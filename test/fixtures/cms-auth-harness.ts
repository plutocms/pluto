import type { H3Event } from 'h3'
import type { createFakeGithub } from './fake-github'
import { createApp, createRouter, defineEventHandler, toWebHandler } from 'h3'
import callback from '../../modules/pluto-cms/runtime/server/api/auth/github/callback.get'
import login from '../../modules/pluto-cms/runtime/server/api/auth/github/login.get'
import logout from '../../modules/pluto-cms/runtime/server/api/auth/logout.post'
import sessionRoute from '../../modules/pluto-cms/runtime/server/api/auth/session.get'
import origin from '../../server/middleware/pluto-origin'

export { resetTestConfig, SESSION_PASSWORD, testConfig } from './cms-test-config'

export interface TestResponse {
  status: number
  headers: Headers
  location: string | null
  json: () => Promise<any>
  text: () => Promise<string>
}

let ipCounter = 0

/**
 * An h3 app with the sign-in routes and the origin check, and a client that
 * keeps cookies like a browser. It does not follow redirects. Each request
 * gets a new fake IP, so the rate limit does not link tests.
 */
export function createAuthApp(extra?: (router: ReturnType<typeof createRouter>) => void) {
  const app = createApp()
  app.use(origin)
  const router = createRouter()
  router.get('/api/_pluto/auth/github/login', login)
  router.get('/api/_pluto/auth/github/callback', callback)
  router.post('/api/_pluto/auth/logout', logout)
  router.get('/api/_pluto/auth/session', sessionRoute)
  router.post('/api/_pluto/echo', defineEventHandler(() => ({ ok: true })))
  router.get('/api/_pluto/echo', defineEventHandler(() => ({ ok: true })))
  extra?.(router)
  app.use(router)
  const handler = toWebHandler(app)

  const jar = new Map<string, string>()
  const deleted: string[] = []

  function storeCookies(headers: Headers) {
    for (const line of headers.getSetCookie()) {
      const [pair = '', ...attributes] = line.split(';').map((part) => part.trim())
      const index = pair.indexOf('=')
      const name = pair.slice(0, index)
      const value = pair.slice(index + 1)
      const expired = attributes.some((attribute) => /^expires=/i.test(attribute) && Date.parse(attribute.slice('expires='.length)) < Date.now())
      if (value === '' || expired) {
        jar.delete(name)
        deleted.push(name)
      } else {
        jar.set(name, value)
      }
    }
  }

  async function request(
    path: string,
    init: {
 method?: string
headers?: Record<string, string>
ip?: string
sameOrigin?: boolean
body?: unknown
} = {}
  ): Promise<TestResponse> {
    const method = init.method ?? 'GET'
    const headers: Record<string, string> = {
      'host': 'cms.test',
      'x-forwarded-for': init.ip ?? `10.0.${Math.floor(++ipCounter / 250)}.${ipCounter % 250}`,
      ...init.headers,
    }
    if (init.sameOrigin !== false && method !== 'GET' && !headers.origin && !headers.referer) {
      headers.origin = 'http://cms.test'
    }
    if (jar.size > 0) {
      headers.cookie = [...jar].map(([name, value]) => `${name}=${value}`).join('; ')
    }
    if (init.body !== undefined) {
      headers['content-type'] = 'application/json'
    }
    const response = await handler(new Request(`http://cms.test${path}`, {
      method,
      headers,
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    }))
    storeCookies(response.headers)
    return {
      status: response.status,
      headers: response.headers,
      location: response.headers.get('location'),
      json: () => response.json(),
      text: () => response.text(),
    }
  }

  return { request, jar, deleted, handler }
}

/** The fake event of a unit test of a function that reads the socket and the headers. */
export function fakeEvent(options: {
 address?: string
headers?: Record<string, string>
} = {}): H3Event {
  return {
    node: { req: { socket: { remoteAddress: options.address }, headers: options.headers ?? {} } },
    context: {},
  } as unknown as H3Event
}

/** Runs the whole sign-in with a fake GitHub and returns the cookie jar owner. */
export async function signIn(
  app: ReturnType<typeof createAuthApp>,
  fake: ReturnType<typeof createFakeGithub>,
  login: string,
  redirect?: string
) {
  const start = await app.request(`/api/_pluto/auth/github/login${redirect ? `?redirect=${encodeURIComponent(redirect)}` : ''}`)
  const authorize = new URL(start.location!)
  const code = fake.oauth.issueCode(login)
  const done = await app.request(`/api/_pluto/auth/github/callback?code=${code}&state=${authorize.searchParams.get('state')}`)
  return { start, authorize, done }
}

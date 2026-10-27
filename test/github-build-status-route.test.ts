import type { GithubFetch } from '../modules/pluto-github/runtime/server/github/client'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import buildStatusRoute from '../modules/pluto-github/runtime/server/api/build-status.get'
import { clearBuildStatusCache } from '../modules/pluto-github/runtime/server/utils/build-status'
import { createFakeGithub } from './fixtures/fake-github'
import { createAuthApp, resetTestConfig, signIn } from './fixtures/github-auth-harness'

vi.mock('../modules/pluto-github/runtime/server/utils/github-config', async () => {
  const { testConfig } = await import('./fixtures/github-test-config')
  return { getGithubConfig: () => testConfig }
})

const SHA = 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678'
const URL_PATH = '/api/_pluto/github/build-status'

interface Answers {
  checks?: unknown
  status?: unknown
  deployments?: unknown
  deploymentStatuses?: Record<string, unknown>
  /** A status code for a source, instead of its data. */
  fail?: Partial<Record<'commit' | 'checks' | 'status' | 'deployments', {
 status: number
headers?: Record<string, string>
}>>
}

/** The fake GitHub, plus the build-status calls. */
function setup(answers: Answers = {}) {
  const fake = createFakeGithub({ users: { ada: { id: 7, permission: 'push' } } })
  const calls: {
 path: string
token: string
}[] = []
  const respond = (status: number, data: unknown, headers: Record<string, string> = {}) => ({
    status,
    headers: { get: (name: string) => headers[name.toLowerCase()] ?? null },
    data,
  })
  const fetch: GithubFetch = async (url, init) => {
    const { pathname, search } = new URL(url)
    const token = (init.headers.Authorization ?? '').replace(/^Bearer /, '')
    const prefix = '/repos/acme/site'
    const fail = (key: keyof NonNullable<Answers['fail']>) => {
      const stub = answers.fail?.[key]
      return stub ? respond(stub.status, { message: stub.status === 403 && stub.headers ? 'API rate limit exceeded' : 'Resource not accessible by integration' }, stub.headers) : undefined
    }

    if (pathname === `${prefix}/commits/main` && init.headers.Accept === 'application/vnd.github+json') {
      calls.push({ path: pathname, token })
      return fail('commit') ?? respond(200, {
        sha: SHA,
        commit: { message: 'content(post): update "a"\n\nbody', committer: { date: '2026-10-26T10:00:00Z' } },
      })
    }
    if (pathname === `${prefix}/commits/${SHA}/check-runs`) {
      calls.push({ path: pathname + search, token })
      return fail('checks') ?? respond(200, answers.checks ?? { total_count: 0, check_runs: [] })
    }
    if (pathname === `${prefix}/commits/${SHA}/status`) {
      calls.push({ path: pathname + search, token })
      return fail('status') ?? respond(200, answers.status ?? { state: 'pending', statuses: [] })
    }
    if (pathname === `${prefix}/deployments`) {
      calls.push({ path: pathname + search, token })
      return fail('deployments') ?? respond(200, answers.deployments ?? [])
    }
    const statusMatch = /^\/repos\/acme\/site\/deployments\/(\d+)\/statuses$/.exec(pathname)
    if (statusMatch) {
      calls.push({ path: pathname + search, token })
      return respond(200, answers.deploymentStatuses?.[statusMatch[1]!] ?? [])
    }
    return fake.fetch(url, init)
  }
  return { fake, fetch, calls }
}

async function signedIn(answers: Answers = {}, patch: Parameters<typeof resetTestConfig>[1] = {}) {
  const { fake, fetch, calls } = setup(answers)
  resetTestConfig(fake, { ...patch, fetch })
  const app = createAuthApp((router) => router.get(URL_PATH, buildStatusRoute))
  await signIn(app, fake, 'ada')
  return { app, calls }
}

beforeEach(() => {
  clearBuildStatusCache()
})

describe('gET /api/_pluto/github/build-status', () => {
  it('needs a signed-in user', async () => {
    const { fake, fetch } = setup()
    resetTestConfig(fake, { fetch })
    const app = createAuthApp((router) => router.get(URL_PATH, buildStatusRoute))
    const response = await app.request(URL_PATH)
    expect(response.status).toBe(401)
  })

  it('answers none when the commit has no item', async () => {
    const { app } = await signedIn()
    const response = await app.request(URL_PATH)
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(await response.json()).toEqual({
      sha: SHA,
      shortSha: 'a1b2c3d',
      message: 'content(post): update "a"',
      committedAt: '2026-10-26T10:00:00Z',
      state: 'none',
      items: [],
    })
  })

  it('answers pending with a running Action', async () => {
    const { app } = await signedIn({
      checks: {
        total_count: 1,
        check_runs: [{ name: 'deploy', status: 'in_progress', conclusion: null, html_url: 'https://github.com/acme/site/actions/runs/5', started_at: '2026-10-26T10:00:05Z' }],
      },
    })
    const body = await (await app.request(URL_PATH)).json()
    expect(body.state).toBe('pending')
    expect(body.items).toEqual([{ kind: 'check', name: 'deploy', state: 'pending', url: 'https://github.com/acme/site/actions/runs/5', startedAt: '2026-10-26T10:00:05Z' }])
  })

  it('merges check runs, commit statuses and deployments', async () => {
    const { app, calls } = await signedIn({
      checks: { check_runs: [{ name: 'lint', status: 'completed', conclusion: 'success', html_url: 'https://github.com/acme/site/actions/runs/1' }] },
      status: { state: 'success', statuses: [{ context: 'Vercel', state: 'success', target_url: 'https://vercel.com/x', description: 'Deployment has completed' }] },
      deployments: [{ id: 11, environment: 'Production', created_at: '2026-10-26T10:00:00Z' }],
      deploymentStatuses: { 11: [{ state: 'success', log_url: 'https://vercel.com/log', created_at: '2026-10-26T10:02:00Z' }] },
    })
    const body = await (await app.request(URL_PATH)).json()
    expect(body.state).toBe('success')
    expect(body.items.map((item: {
 kind: string
name: string
state: string
}) => [item.kind, item.name, item.state])).toEqual([
      ['check', 'lint', 'success'],
      ['status', 'Vercel', 'success'],
      ['deployment', 'Production', 'success'],
    ])
    // Every call uses the token of the user, never a server token.
    expect(calls.every((call) => call.token !== '')).toBe(true)
    expect(new Set(calls.map((call) => call.token)).size).toBe(1)
  })

  it('answers failure when a check fails', async () => {
    const { app } = await signedIn({
      checks: { check_runs: [{ name: 'build', status: 'completed', conclusion: 'failure', html_url: 'https://github.com/acme/site/actions/runs/2' }] },
    })
    expect((await (await app.request(URL_PATH)).json()).state).toBe('failure')
  })

  it('keeps a source that GitHub refuses out of the answer, and says so', async () => {
    const { app } = await signedIn({
      fail: { checks: { status: 403 }, deployments: { status: 404 } },
      status: { statuses: [{ context: 'Vercel', state: 'pending' }] },
    })
    const body = await (await app.request(URL_PATH)).json()
    expect(body.state).toBe('pending')
    expect(body.unavailable.toSorted()).toEqual(['check', 'deployment'])
  })

  it('shares the calls of one commit for a few seconds', async () => {
    const { app, calls } = await signedIn()
    await app.request(URL_PATH)
    const first = calls.length
    await app.request(URL_PATH)
    // The second request reads the commit again, and nothing else.
    expect(calls.length).toBe(first + 1)
  })

  it('answers 503 with Retry-After on a rate limit', async () => {
    const { app } = await signedIn({ fail: { checks: { status: 403, headers: { 'retry-after': '30' } } } })
    const response = await app.request(URL_PATH)
    expect(response.status).toBe(503)
    expect(response.headers.get('retry-after')).toBe('30')
  })

  it('answers 502 when GitHub fails', async () => {
    const { app } = await signedIn({ fail: { commit: { status: 500 } } })
    expect((await app.request(URL_PATH)).status).toBe(502)
  })

  it('answers none for the fs store, with no GitHub call', async () => {
    const { app, calls } = await signedIn({}, { storage: 'fs' })
    const body = await (await app.request(URL_PATH)).json()
    expect(body).toMatchObject({ state: 'none', items: [] })
    expect(calls).toHaveLength(0)
  })
})

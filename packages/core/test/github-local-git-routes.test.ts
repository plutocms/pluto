import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import pushRoute from '../modules/pluto-github/runtime/server/api/local/push.post'
import statusRoute from '../modules/pluto-github/runtime/server/api/local/status.get'
import { createAuthApp, resetTestConfig } from './fixtures/github-auth-harness'

vi.mock(
  '../modules/pluto-github/runtime/server/utils/github-config',
  async () => {
    const { testConfig } = await import('./fixtures/github-test-config')
    return { getGithubConfig: () => testConfig }
  }
)

const LOCAL = { ip: '127.0.0.1', headers: { host: 'localhost:3000' } }
const STATUS = '/api/_pluto/github/local/status'
const PUSH = '/api/_pluto/github/local/push'

let root: string

function app() {
  return createAuthApp((router) => {
    router.get(STATUS, statusRoute)
    router.post(PUSH, pushRoute)
  })
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'pluto-local-routes-'))
  const git = (...args: string[]) => execFileSync('git', args, { cwd: root })
  git('init', '-q')
  git('config', 'user.name', 'Test')
  git('config', 'user.email', 'test@example.com')
  git('config', 'commit.gpgsign', 'false')
  writeFileSync(join(root, 'a.md'), 'a')
  git('add', 'a.md')
  git('commit', '-q', '-m', 'a')
  resetTestConfig(undefined, { dev: true, storage: 'fs', fsRoot: root })
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

describe('local Git routes', { timeout: 30000 }, () => {
  it('answers the status to the dev local request, with no-store', async () => {
    const response = await app().request(STATUS, LOCAL)

    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(await response.json()).toMatchObject({
      repo: true,
      remote: null,
      ahead: 1,
    })
  })

  it('answers 404 to a request from another machine', async () => {
    expect((await app().request(STATUS)).status).toBe(404)
    expect((await app().request(PUSH, { method: 'POST' })).status).toBe(404)
  })

  it('answers 404 outside dev and with the github store', async () => {
    resetTestConfig(undefined, { dev: false, storage: 'fs', fsRoot: root })
    expect((await app().request(STATUS, LOCAL)).status).toBe(404)

    resetTestConfig(undefined, { dev: true, storage: 'github', fsRoot: root })
    expect((await app().request(STATUS, LOCAL)).status).toBe(404)
  })

  it('refuses a push from another origin', async () => {
    const response = await app().request(PUSH, {
      ip: LOCAL.ip,
      headers: { ...LOCAL.headers, origin: 'http://evil.test' },
      method: 'POST',
    })
    expect(response.status).toBe(403)
  })

  it('gives a translated error when the push cannot run', async () => {
    const response = await app().request(PUSH, {
      ip: LOCAL.ip,
      headers: { ...LOCAL.headers, origin: 'http://localhost:3000' },
      method: 'POST',
    })

    expect(response.status).toBe(409)
    expect((await response.json()).data).toMatchObject({
      reason: 'no-remote',
      i18n: { key: 'pluto.github.local.errors.noRemote' },
    })
  })
})

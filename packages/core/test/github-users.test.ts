import type { GithubFetch } from '../modules/pluto-github/runtime/server/github/client'
import type { GithubCollaborator } from '../modules/pluto-github/runtime/shared/repo-users'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import usersRoute from '../modules/pluto-github/runtime/server/api/users.get'
import { clearGithubUsersCache } from '../modules/pluto-github/runtime/server/utils/github-users'
import {
  repoRoleOf,
  toRepoUsers,
} from '../modules/pluto-github/runtime/shared/repo-users'
import { createFakeGithub } from './fixtures/fake-github'
import {
  createAuthApp,
  resetTestConfig,
  signIn,
} from './fixtures/github-auth-harness'

vi.mock(
  '../modules/pluto-github/runtime/server/utils/github-config',
  async () => {
    const { testConfig } = await import('./fixtures/github-test-config')
    return { getGithubConfig: () => testConfig }
  }
)

const URL_PATH = '/api/_pluto/github/users'
const LOCAL = { ip: '127.0.0.1', headers: { host: 'localhost:3000' } }

function collaborator(
  login: string,
  permissions: GithubCollaborator['permissions'],
  id = login.length
): GithubCollaborator {
  return {
    id,
    login,
    avatar_url: `https://avatars.test/${login}`,
    html_url: `https://github.com/${login}`,
    permissions,
  }
}

describe('repoRoleOf', () => {
  it('picks the highest role, and null below push', () => {
    expect(repoRoleOf(collaborator('a', { admin: true, push: true }))).toBe(
      'admin'
    )
    expect(repoRoleOf(collaborator('a', { maintain: true, push: true }))).toBe(
      'maintain'
    )
    expect(repoRoleOf(collaborator('a', { push: true }))).toBe('write')
    expect(repoRoleOf(collaborator('a', {}))).toBeNull()
    expect(repoRoleOf({ id: 1, login: 'a', role_name: 'write' })).toBe('write')
  })
})

describe('toRepoUsers', () => {
  it('keeps the users who can push, admins first, then by login', () => {
    const users = toRepoUsers(
      [
        collaborator('zed', { push: true }),
        collaborator('reader', {}),
        collaborator('Bob', { push: true }),
        collaborator('owner', { admin: true }),
      ],
      []
    )
    expect(users.map((user) => [user.login, user.role])).toEqual([
      ['owner', 'admin'],
      ['Bob', 'write'],
      ['zed', 'write'],
    ])
    expect(users.every((user) => user.canSignIn)).toBe(true)
  })

  it('marks the users that ALLOWED_USERS blocks, without case', () => {
    const users = toRepoUsers(
      [
        collaborator('Ada', { push: true }),
        collaborator('bob', { push: true }),
      ],
      ['ada']
    )
    expect(users.map((user) => [user.login, user.canSignIn])).toEqual([
      ['Ada', true],
      ['bob', false],
    ])
  })
})

function setup(collaborators: GithubCollaborator[], status = 200) {
  const fake = createFakeGithub({
    users: { ada: { id: 7, permission: 'push' } },
  })
  const calls: {
    page: string | null
    search: string
    token: string
  }[] = []
  const fetch: GithubFetch = async (url, init) => {
    const { pathname, searchParams, search } = new URL(url)
    if (pathname === '/repos/acme/site/collaborators') {
      calls.push({
        page: searchParams.get('page'),
        search,
        token: (init.headers.Authorization ?? '').replace(/^Bearer /, ''),
      })
      const page = Number(searchParams.get('page'))
      return {
        status,
        headers: { get: () => null },
        data:
          status === 200
            ? collaborators.slice((page - 1) * 100, page * 100)
            : { message: 'Resource not accessible by integration' },
      }
    }
    return fake.fetch(url, init)
  }
  return { fake, fetch, calls }
}

function usersApp() {
  return createAuthApp((router) => router.get(URL_PATH, usersRoute))
}

beforeEach(() => {
  clearGithubUsersCache()
})

describe('gET /api/_pluto/github/users', () => {
  it('needs a signed-in user', async () => {
    const { fake, fetch } = setup([])
    resetTestConfig(fake, { fetch })
    expect((await usersApp().request(URL_PATH)).status).toBe(401)
  })

  it('lists the users with the token of the signed-in user, page by page', async () => {
    const many = Array.from({ length: 130 }, (_, index) =>
      collaborator(
        `user${String(index).padStart(3, '0')}`,
        { push: true },
        index
      )
    )
    const { fake, fetch, calls } = setup(many)
    resetTestConfig(fake, { fetch, allowedUsers: ['ada', 'user000'] })
    const app = usersApp()
    await signIn(app, fake, 'ada')

    const response = await app.request(URL_PATH)
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-store')
    const body = await response.json()
    expect(body.repo).toBe('acme/site')
    expect(body.restricted).toBe(true)
    expect(body.users).toHaveLength(130)
    expect(body.users[0]).toEqual({
      id: 0,
      login: 'user000',
      avatarUrl: 'https://avatars.test/user000',
      url: 'https://github.com/user000',
      role: 'write',
      canSignIn: true,
    })
    expect(body.users[1].canSignIn).toBe(false)
    expect(calls.map((call) => call.page)).toEqual(['1', '2'])
    expect(calls[0]!.search).toContain('permission=push')
    expect(calls[0]!.token).not.toBe('')

    // A second read within the cache time makes no call.
    await app.request(URL_PATH)
    expect(calls).toHaveLength(2)
  })

  it('maps a refusal of GitHub to 403', async () => {
    const { fake, fetch } = setup([], 403)
    resetTestConfig(fake, { fetch })
    const app = usersApp()
    await signIn(app, fake, 'ada')
    expect((await app.request(URL_PATH)).status).toBe(403)
  })

  it('answers no-app in local mode without the App', async () => {
    const { fake, fetch, calls } = setup([collaborator('ada', { push: true })])
    resetTestConfig(fake, {
      fetch,
      dev: true,
      storage: 'fs',
      appId: '',
      privateKey: '',
      readToken: '',
    })
    const response = await usersApp().request(URL_PATH, LOCAL)
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      repo: 'acme/site',
      users: [],
      restricted: false,
      reason: 'no-app',
    })
    expect(calls).toHaveLength(0)
  })

  it('reads with the read token in local mode', async () => {
    const { fake, fetch, calls } = setup([collaborator('ada', { push: true })])
    resetTestConfig(fake, {
      fetch,
      dev: true,
      storage: 'fs',
      readToken: 'read-token',
    })
    const body = await (await usersApp().request(URL_PATH, LOCAL)).json()
    expect(body.users.map((user: { login: string }) => user.login)).toEqual([
      'ada',
    ])
    expect(calls[0]!.token).toBe('read-token')
  })

  it('answers app-error in local mode when the App gives no token', async () => {
    const { fake, fetch, calls } = setup([collaborator('ada', { push: true })])
    resetTestConfig(fake, {
      fetch,
      dev: true,
      storage: 'fs',
      appId: '1',
      privateKey: 'not a key',
      readToken: '',
    })
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const body = await (await usersApp().request(URL_PATH, LOCAL)).json()
    expect(body.reason).toBe('app-error')
    expect(calls).toHaveLength(0)
  })

  it('answers no-repo with no repo', async () => {
    const { fake, fetch } = setup([])
    resetTestConfig(fake, { fetch, dev: true, storage: 'fs', repo: '' })
    const body = await (await usersApp().request(URL_PATH, LOCAL)).json()
    expect(body.reason).toBe('no-repo')
  })
})

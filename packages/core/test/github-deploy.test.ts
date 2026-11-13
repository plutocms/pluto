import type { GithubFetch } from '../modules/pluto-github/runtime/server/github/client'
import { execFileSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { parse } from 'yaml'
import dnsRoute from '../modules/pluto-github/runtime/server/api/deploy/dns.get'
import removeRoute from '../modules/pluto-github/runtime/server/api/deploy/pages.delete'
import pagesRoute from '../modules/pluto-github/runtime/server/api/deploy/pages.post'
import statusRoute from '../modules/pluto-github/runtime/server/api/deploy/status.get'
import { clearGithubUsersCache } from '../modules/pluto-github/runtime/server/utils/github-users'
import {
  detectDeployHost,
  hostDomainSettingsUrl,
  isApexDomain,
  normalizeDomain,
} from '../modules/pluto-github/runtime/shared/domain'
import {
  defaultPagesUrl,
  detectPackageManager,
  PAGES_WORKFLOW_PATH,
  PUBLISH_SCHEDULED_SCRIPT,
  renderPagesWorkflow,
} from '../modules/pluto-github/runtime/shared/pages-workflow'
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

// The DNS is faked: a test sets the records of each name. A missing record throws, like Node.
const dns = vi.hoisted(() => ({
  records: {} as Record<
    string,
    { cname?: string[]; a?: string[]; aaaa?: string[] }
  >,
}))
vi.mock('node:dns/promises', () => {
  const lookup = (kind: 'cname' | 'a' | 'aaaa') => async (name: string) => {
    const found = dns.records[name]?.[kind]
    if (!found?.length) {
      throw Object.assign(new Error(`queryX ENODATA ${name}`), {
        code: 'ENODATA',
      })
    }
    return found
  }
  return {
    resolveCname: lookup('cname'),
    resolve4: lookup('a'),
    resolve6: lookup('aaaa'),
  }
})

// The deployments of the `github-pages` environment. A private repo answers 404 with no token.
const api = vi.hoisted(() => ({
  deployments: [] as Array<{
    id: number
    statuses: Array<Record<string, string>>
  }>,
  private: false,
  calls: [] as Array<{ method: string; path: string; token: string }>,
}))

function githubFetch(fallback?: GithubFetch): GithubFetch {
  return async (url, init) => {
    const { pathname, searchParams } = new URL(url)
    const deployments = pathname === '/repos/acme/site/deployments'
    const statuses = /^\/repos\/acme\/site\/deployments\/(\d+)\/statuses$/.exec(
      pathname
    )
    if (!deployments && !statuses && fallback) {
      return fallback(url, init)
    }
    const token = (init.headers.Authorization ?? '').replace(/^Bearer /, '')
    api.calls.push({ method: init.method, path: pathname, token })
    const answer = (status: number, data: unknown) => ({
      status,
      headers: { get: () => null },
      data,
    })
    if (api.private && !token) {
      return answer(404, { message: 'Not Found' })
    }
    if (deployments) {
      expect(searchParams.get('environment')).toBe('github-pages')
      return answer(
        200,
        api.deployments.map(({ id }) => ({ id }))
      )
    }
    const found = api.deployments.find(
      (deployment) => deployment.id === Number(statuses![1])
    )
    return answer(200, found?.statuses ?? [])
  }
}

const LOCAL = { ip: '127.0.0.1', headers: { host: 'localhost:3000' } }
const POST_LOCAL = {
  ip: '127.0.0.1',
  method: 'POST',
  headers: { host: 'localhost:3000', origin: 'http://localhost:3000' },
}

describe('the Pages workflow', () => {
  it('finds the package manager from the lock file', () => {
    expect(detectPackageManager(['package.json', 'bun.lock'])).toBe('bun')
    expect(detectPackageManager(['pnpm-lock.yaml'])).toBe('pnpm')
    expect(detectPackageManager(['yarn.lock'])).toBe('yarn')
    expect(detectPackageManager(['package-lock.json'])).toBe('npm')
    expect(detectPackageManager([])).toBe('npm')
  })

  it('is valid YAML that builds with the static preset and the base path', () => {
    for (const packageManager of ['npm', 'pnpm', 'yarn', 'bun'] as const) {
      const text = renderPagesWorkflow({ branch: 'main', packageManager })
      const workflow = parse(text)
      expect(workflow.on.push.branches).toEqual(['main'])
      expect(workflow.permissions).toEqual({
        contents: 'read',
        pages: 'write',
        'id-token': 'write',
      })
      const steps = workflow.jobs.build.steps as Array<{
        run?: string
        uses?: string
        env?: Record<string, string>
      }>
      const build = steps.find((step) => step.run?.includes('nuxt generate'))!
      expect(build.run).toContain('--preset github_pages')
      expect(build.env).toEqual({
        // eslint-disable-next-line no-template-curly-in-string -- a GitHub Actions expression
        PLUTO_BASE_URL: '${{ steps.pages.outputs.base_path }}',
        // eslint-disable-next-line no-template-curly-in-string -- a GitHub Actions expression
        NUXT_PUBLIC_WEBSITE_URL: '${{ steps.pages.outputs.base_url }}',
      })
      expect(steps.at(-1)!.uses).toBe('actions/upload-pages-artifact@v3')
      expect(workflow.jobs.deploy.steps[0].uses).toBe('actions/deploy-pages@v4')
    }
  })

  it('publishes the scheduled posts every hour, and builds only after a publish', () => {
    const workflow = parse(
      renderPagesWorkflow({
        branch: 'site',
        packageManager: 'npm',
        dir: 'docs/content',
      })
    )

    expect(workflow.on.schedule).toEqual([{ cron: '17 * * * *' }])
    const publish = workflow.jobs.publish
    expect(publish.if).toBe("github.event_name == 'schedule'")
    expect(publish.permissions).toEqual({ contents: 'write' })
    expect(publish.steps[0]).toEqual({
      uses: 'actions/checkout@v4',
      with: { ref: 'site' },
    })
    expect(publish.steps[1].env).toEqual({ PLUTO_CONTENT_DIR: 'docs/content' })
    expect(publish.steps[1].run).toContain("node --input-type=module <<'PLUTO'")
    expect(publish.steps[2].run).toContain('git push')
    expect(workflow.jobs.build.needs).toBe('publish')
    expect(workflow.jobs.build.if).toContain(
      "needs.publish.outputs.published != '0'"
    )
    expect(workflow.jobs.build.steps[0].with).toEqual({ ref: 'site' })
  })

  it('has a publish script that changes only the status line of the due posts', () => {
    const root = mkdtempSync(join(tmpdir(), 'pluto-pages-publish-'))
    const file = (path: string, front: string) => {
      mkdirSync(join(root, 'content', path, '..'), { recursive: true })
      writeFileSync(
        join(root, 'content', path),
        `---\ntitle: A\n${front}\n---\nBody\n`
      )
    }
    file(
      'posts/due.md',
      'status: scheduled\npublishedAt: 2020-01-01T09:00:00.000Z'
    )
    file(
      'posts/quoted.md',
      "status: 'scheduled'\npublishedAt: '2020-01-01T09:00:00Z'"
    )
    file(
      'docs/1.guide/nested.md',
      'status: scheduled\npublishedAt: 2020-01-01T09:00:00Z'
    )
    file(
      'posts/later.md',
      'status: scheduled\npublishedAt: 2999-01-01T09:00:00Z'
    )
    file('posts/no-time.md', 'status: scheduled')
    file('posts/draft.md', 'status: draft\npublishedAt: 2020-01-01T09:00:00Z')
    file(
      '.trash/post/gone.md',
      'status: scheduled\npublishedAt: 2020-01-01T09:00:00Z'
    )
    const output = join(root, 'output.txt')
    writeFileSync(output, '')
    try {
      execFileSync(
        process.execPath,
        ['--input-type=module', '-e', PUBLISH_SCHEDULED_SCRIPT.join('\n')],
        {
          cwd: root,
          env: { ...process.env, GITHUB_OUTPUT: output, PLUTO_CONTENT_DIR: '' },
        }
      )
      const read = (path: string) =>
        readFileSync(join(root, 'content', path), 'utf8')

      expect(readFileSync(output, 'utf8')).toBe('published=3\n')
      expect(read('posts/due.md')).toBe(
        '---\ntitle: A\nstatus: published\npublishedAt: 2020-01-01T09:00:00.000Z\n---\nBody\n'
      )
      expect(read('posts/quoted.md')).toContain('status: published')
      expect(read('docs/1.guide/nested.md')).toContain('status: published')
      for (const path of [
        'posts/later.md',
        'posts/no-time.md',
        '.trash/post/gone.md',
      ]) {
        expect(read(path), path).toContain('status: scheduled')
      }
      expect(read('posts/draft.md')).toContain('status: draft')
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('gives the default address of the site', () => {
    expect(defaultPagesUrl('Acme/site')).toBe('https://acme.github.io/site/')
    expect(defaultPagesUrl('acme/acme.github.io')).toBe(
      'https://acme.github.io/'
    )
  })
})

describe('the domain helpers', () => {
  it('takes a domain, and removes a scheme and a trailing slash', () => {
    expect(normalizeDomain(' Blog.Example.com ')).toBe('blog.example.com')
    expect(normalizeDomain('https://example.com/')).toBe('example.com')
    expect(normalizeDomain('example.co.uk.')).toBe('example.co.uk')
    expect(normalizeDomain('')).toBe('')
  })

  it('refuses a value that is not a domain', () => {
    for (const value of [
      'localhost',
      'example.com/blog',
      'example.com:8080',
      '-a.example.com',
      'a_b.example.com',
      '185.199.108.153',
      'exa mple.com',
    ]) {
      expect(normalizeDomain(value), value).toBeNull()
    }
  })

  it('guesses an apex domain from the labels', () => {
    expect(isApexDomain('example.com')).toBe(true)
    expect(isApexDomain('blog.example.com')).toBe(false)
  })

  it('finds the host from its env vars', () => {
    expect(
      detectDeployHost({
        VERCEL: '1',
        VERCEL_PROJECT_PRODUCTION_URL: 'blog.vercel.app',
      })
    ).toEqual({ id: 'vercel', site: 'blog.vercel.app' })
    expect(detectDeployHost({ NETLIFY: 'true', SITE_NAME: 'blog' })).toEqual({
      id: 'netlify',
      site: 'blog',
    })
    expect(detectDeployHost({})).toEqual({ id: '', site: '' })
  })

  it('links to the domain settings of a host', () => {
    expect(hostDomainSettingsUrl('netlify', 'blog')).toBe(
      'https://app.netlify.com/projects/blog/domain-management'
    )
    expect(hostDomainSettingsUrl('vercel')).toContain('settings%2Fdomains')
  })
})

describe('the deploy routes', { timeout: 30000 }, () => {
  let root: string

  function app() {
    return createAuthApp((router) => {
      router.get('/api/_pluto/github/deploy/status', statusRoute)
      router.post('/api/_pluto/github/deploy/pages', pagesRoute)
      router.delete('/api/_pluto/github/deploy/pages', removeRoute)
      router.get('/api/_pluto/github/deploy/dns', dnsRoute)
    })
  }

  async function localStatus() {
    return (
      await app().request('/api/_pluto/github/deploy/status', LOCAL)
    ).json()
  }

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'pluto-deploy-'))
    const git = (...args: string[]) => execFileSync('git', args, { cwd: root })
    git('init', '-q')
    git('config', 'user.name', 'Test')
    git('config', 'user.email', 'test@example.com')
    git('config', 'commit.gpgsign', 'false')
    writeFileSync(join(root, 'package.json'), '{}')
    writeFileSync(join(root, 'bun.lock'), '')
    git('add', '-A')
    git('commit', '-q', '-m', 'init')
    resetTestConfig(undefined, {
      dev: true,
      storage: 'fs',
      fsRoot: root,
      fetch: githubFetch(),
    })
    clearGithubUsersCache()
    api.deployments = []
    api.private = false
    api.calls = []
    dns.records = {}
  })

  afterEach(() => {
    rmSync(root, { recursive: true, force: true })
  })

  it('needs a signed-in user', async () => {
    resetTestConfig(undefined, { dev: false, storage: 'github' })
    const response = await app().request('/api/_pluto/github/deploy/status')
    expect(response.status).toBe(401)
  })

  it('reads the workflow and the host in local mode', async () => {
    resetTestConfig(undefined, {
      dev: true,
      storage: 'fs',
      fsRoot: root,
      fetch: githubFetch(),
      host: 'netlify',
      hostSite: 'acme',
    })
    const body = await localStatus()
    expect(body).toMatchObject({
      repo: 'acme/site',
      local: true,
      packageManager: 'bun',
      workflow: { path: PAGES_WORKFLOW_PATH, exists: false, current: false },
      deploy: { state: 'none' },
      pagesUrl: 'https://acme.github.io/site/',
      host: { id: 'netlify', site: 'acme' },
    })
    expect(body.workflow.text).toContain('bunx nuxt generate')
  })

  it('reads the last deploy with no token for a public repo', async () => {
    api.deployments = [
      {
        id: 9,
        statuses: [
          {
            state: 'success',
            environment_url: 'https://blog.acme.com/',
            log_url: 'https://github.com/acme/site/actions/runs/1',
            created_at: '2026-11-02T10:00:00Z',
          },
        ],
      },
    ]
    const body = await localStatus()
    expect(body.deploy).toEqual({
      state: 'success',
      url: 'https://blog.acme.com/',
      logUrl: 'https://github.com/acme/site/actions/runs/1',
      at: '2026-11-02T10:00:00Z',
    })
    expect(api.calls.every((call) => call.token === '')).toBe(true)
  })

  it('maps a failed and a running deploy', async () => {
    api.deployments = [{ id: 1, statuses: [{ state: 'error' }] }]
    expect((await localStatus()).deploy.state).toBe('failure')
    api.deployments = [{ id: 1, statuses: [{ state: 'in_progress' }] }]
    expect((await localStatus()).deploy.state).toBe('pending')
    api.deployments = [{ id: 1, statuses: [] }]
    expect((await localStatus()).deploy.state).toBe('pending')
  })

  it('reads a private repo with the read token of .env', async () => {
    api.private = true
    api.deployments = [{ id: 1, statuses: [{ state: 'success' }] }]
    expect((await localStatus()).deploy).toEqual({ state: 'unknown' })

    resetTestConfig(undefined, {
      dev: true,
      storage: 'fs',
      fsRoot: root,
      fetch: githubFetch(),
      readToken: 'read-token',
    })
    expect((await localStatus()).deploy.state).toBe('success')
    expect(api.calls.at(-1)!.token).toBe('read-token')
  })

  it('reads with the token of the signed-in user on a live admin', async () => {
    const fake = createFakeGithub({
      users: { ada: { id: 7, permission: 'push' } },
    })
    resetTestConfig(fake, {
      fetch: githubFetch(fake.fetch),
      allowedUsers: ['ada'],
    })
    api.private = true
    api.deployments = [{ id: 1, statuses: [{ state: 'success' }] }]
    const live = app()
    await signIn(live, fake, 'ada')
    const body = await (
      await live.request('/api/_pluto/github/deploy/status')
    ).json()
    expect(body).toMatchObject({
      local: false,
      siteHost: 'cms.test',
      deploy: { state: 'success' },
    })
    expect(body.workflow.exists).toBeUndefined()
    expect(api.calls.at(-1)!.token).not.toBe('')
  })

  it('writes and commits the workflow, and changes nothing on GitHub', async () => {
    const response = await app().request(
      '/api/_pluto/github/deploy/pages',
      POST_LOCAL
    )
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.committed).toBe(true)
    expect(body.status.workflow).toMatchObject({ exists: true, current: true })
    expect(readFileSync(join(root, PAGES_WORKFLOW_PATH), 'utf8')).toBe(
      body.status.workflow.text
    )
    expect(
      execFileSync('git', ['log', '-1', '--format=%s'], { cwd: root })
        .toString()
        .trim()
    ).toBe('ci: deploy the site to GitHub Pages')
    expect(api.calls.every((call) => call.method === 'GET')).toBe(true)

    const again = await (
      await app().request('/api/_pluto/github/deploy/pages', POST_LOCAL)
    ).json()
    expect(again.committed).toBe(false)
  })

  it('refuses the setup outside local mode', async () => {
    resetTestConfig(undefined, { dev: false, storage: 'fs', fsRoot: root })
    const response = await app().request(
      '/api/_pluto/github/deploy/pages',
      POST_LOCAL
    )
    expect(response.status).toBe(404)
    expect(existsSync(join(root, PAGES_WORKFLOW_PATH))).toBe(false)
  })

  it('removes the workflow with a commit, and changes nothing on GitHub', async () => {
    await app().request('/api/_pluto/github/deploy/pages', POST_LOCAL)
    const DELETE_LOCAL = { ...POST_LOCAL, method: 'DELETE' }
    const response = await app().request(
      '/api/_pluto/github/deploy/pages',
      DELETE_LOCAL
    )
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.committed).toBe(true)
    expect(body.status.workflow).toMatchObject({
      exists: false,
      current: false,
    })
    expect(existsSync(join(root, PAGES_WORKFLOW_PATH))).toBe(false)
    const git = (...args: string[]) =>
      execFileSync('git', args, { cwd: root }).toString().trim()
    expect(git('log', '-1', '--format=%s')).toBe(
      'ci: stop deploying the site to GitHub Pages'
    )
    expect(git('status', '--porcelain')).toBe('')
    expect(api.calls.every((call) => call.method === 'GET')).toBe(true)

    const again = await (
      await app().request('/api/_pluto/github/deploy/pages', DELETE_LOCAL)
    ).json()
    expect(again.committed).toBe(false)
  })

  it('refuses the removal outside local mode', async () => {
    await app().request('/api/_pluto/github/deploy/pages', POST_LOCAL)
    resetTestConfig(undefined, { dev: false, storage: 'fs', fsRoot: root })
    const response = await app().request('/api/_pluto/github/deploy/pages', {
      ...POST_LOCAL,
      method: 'DELETE',
    })
    expect(response.status).toBe(404)
    expect(existsSync(join(root, PAGES_WORKFLOW_PATH))).toBe(true)
  })

  describe('the DNS check', () => {
    async function checkDns(domain: string) {
      return app().request(
        `/api/_pluto/github/deploy/dns?domain=${encodeURIComponent(domain)}`,
        LOCAL
      )
    }

    it('finds the A records of GitHub Pages on an apex domain', async () => {
      dns.records['acme.com'] = {
        a: ['185.199.108.153', '185.199.109.153'],
        aaaa: ['2606:50c0:8000::153'],
      }
      const body = await (await checkDns('https://Acme.com/')).json()
      expect(body).toEqual({
        domain: 'acme.com',
        state: 'ok',
        found: ['185.199.108.153', '185.199.109.153', '2606:50c0:8000::153'],
      })
    })

    it('follows the CNAME of a subdomain to the addresses of GitHub Pages', async () => {
      dns.records['blog.acme.com'] = {
        cname: ['acme.github.io.'],
        a: ['185.199.110.153'],
      }
      const body = await (await checkDns('blog.acme.com')).json()
      expect(body).toMatchObject({
        state: 'ok',
        found: ['acme.github.io', '185.199.110.153'],
      })
    })

    it('tells when the domain points somewhere else', async () => {
      dns.records['acme.com'] = { a: ['185.199.108.153', '76.76.21.21'] }
      expect((await (await checkDns('acme.com')).json()).state).toBe('other')
    })

    it('tells when the domain has no records yet', async () => {
      expect(await (await checkDns('acme.com')).json()).toEqual({
        domain: 'acme.com',
        state: 'missing',
        found: [],
      })
    })

    it('refuses a value that is not a domain', async () => {
      const response = await checkDns('not a domain')
      expect(response.status).toBe(400)
      expect((await response.json()).data.i18n.key).toBe(
        'pluto.github.deploy.domain.errors.invalid'
      )
    })

    it('needs a signed-in user', async () => {
      resetTestConfig(undefined, { dev: false, storage: 'github' })
      expect(
        (await app().request('/api/_pluto/github/deploy/dns?domain=acme.com'))
          .status
      ).toBe(401)
    })
  })
})

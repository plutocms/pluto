import { execFileSync } from 'node:child_process'
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { parse } from 'yaml'
import domainRoute from '../modules/pluto-github/runtime/server/api/deploy/domain.post'
import pagesRoute from '../modules/pluto-github/runtime/server/api/deploy/pages.post'
import statusRoute from '../modules/pluto-github/runtime/server/api/deploy/status.get'
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
  renderPagesWorkflow,
} from '../modules/pluto-github/runtime/shared/pages-workflow'
import { createAuthApp, resetTestConfig } from './fixtures/github-auth-harness'

vi.mock(
  '../modules/pluto-github/runtime/server/utils/github-config',
  async () => {
    const { testConfig } = await import('./fixtures/github-test-config')
    return { getGithubConfig: () => testConfig }
  }
)

// The GitHub CLI is faked: a test sets the answer of each `gh api` call. Git runs for real.
interface FakePages {
  build_type: string
  html_url: string
  cname?: string | null
  https_enforced?: boolean
  https_certificate?: { state: string }
}
const gh = vi.hoisted(() => ({
  pages: null as null | FakePages,
  installed: true,
  signedIn: true,
  /** The workflow is on GitHub, so `gh workflow run` works. */
  workflowOnGithub: true,
  /** A domain that another Pages site uses. */
  takenDomain: '',
  calls: [] as string[][],
}))
vi.mock('node:child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:child_process')>()
  const { promisify } = await import('node:util')
  type Callback = (error: unknown, stdout?: string, stderr?: string) => void
  const execFile = ((
    file: string,
    args: string[],
    options: unknown,
    callback: Callback
  ) => {
    if (file !== 'gh') {
      return actual.execFile(file, args, options as never, callback as never)
    }
    gh.calls.push(args)
    const fail = (message: string, code?: string) =>
      callback(Object.assign(new Error(message), { code }), '', message)
    if (!gh.installed) {
      return fail('spawn gh ENOENT', 'ENOENT')
    }
    if (!gh.signedIn) {
      return fail('To get started with GitHub CLI, please run:  gh auth login')
    }
    if (args[0] === 'workflow') {
      return gh.workflowOnGithub
        ? callback(null, '', '')
        : fail('could not find any workflows named pluto-pages.yml')
    }
    const field = args[args.indexOf('-F') + 1]
    if (args.includes('-X') && args.includes('-F') && field) {
      const [key, value] = field.split('=')
      if (key === 'cname' && value === gh.takenDomain) {
        return fail(`gh: The CNAME ${value} is already taken. (HTTP 400)`)
      }
      gh.pages =
        key === 'cname'
          ? { ...gh.pages!, cname: value === 'null' ? null : value }
          : { ...gh.pages!, https_enforced: value === 'true' }
      return callback(null, '{}', '')
    }
    if (args.includes('-X')) {
      gh.pages = {
        build_type: 'workflow',
        html_url: 'https://acme.github.io/site/',
      }
      return callback(null, '{}', '')
    }
    return gh.pages
      ? callback(null, JSON.stringify(gh.pages), '')
      : fail('gh: Not Found (HTTP 404)')
  }) as unknown as typeof actual.execFile
  // `promisify(execFile)` gives `{ stdout, stderr }`, and the error holds them too, like Node.
  Object.assign(execFile, {
    [promisify.custom]: (file: string, args: string[], options: unknown) =>
      new Promise((resolve, reject) => {
        ;(execFile as unknown as (...rest: unknown[]) => void)(
          file,
          args,
          options,
          (error: unknown, stdout = '', stderr = '') =>
            error
              ? reject(Object.assign(error as object, { stdout, stderr }))
              : resolve({ stdout, stderr })
        )
      }),
  })
  return { ...actual, execFile }
})

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
      const build = steps.find((step) => step.run?.includes('nuxt build'))!
      expect(build.run).toContain('--preset github_pages')
      expect(build.env).toEqual({
        // eslint-disable-next-line no-template-curly-in-string -- a GitHub Actions expression
        PLUTO_BASE_URL: '${{ steps.pages.outputs.base_path }}',
      })
      expect(steps.at(-1)!.uses).toBe('actions/upload-pages-artifact@v3')
      expect(workflow.jobs.deploy.steps[0].uses).toBe('actions/deploy-pages@v4')
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
      router.post('/api/_pluto/github/deploy/domain', domainRoute)
    })
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
    resetTestConfig(undefined, { dev: true, storage: 'fs', fsRoot: root })
    gh.pages = null
    gh.installed = true
    gh.signedIn = true
    gh.workflowOnGithub = true
    gh.takenDomain = ''
    gh.calls = []
  })

  afterEach(() => {
    rmSync(root, { recursive: true, force: true })
  })

  it('needs a signed-in user', async () => {
    resetTestConfig(undefined, { dev: false, storage: 'github' })
    const response = await app().request('/api/_pluto/github/deploy/status')
    expect(response.status).toBe(401)
  })

  it('reads the workflow and Pages in local mode', async () => {
    const body = await (
      await app().request('/api/_pluto/github/deploy/status', LOCAL)
    ).json()
    expect(body).toMatchObject({
      repo: 'acme/site',
      local: true,
      packageManager: 'bun',
      workflow: { path: PAGES_WORKFLOW_PATH, exists: false, current: false },
      pages: { state: 'off' },
      pagesUrl: 'https://acme.github.io/site/',
    })
    expect(body.workflow.text).toContain('bunx nuxt build')
  })

  it('writes and commits the workflow, then turns Pages on', async () => {
    const response = await app().request(
      '/api/_pluto/github/deploy/pages',
      POST_LOCAL
    )
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body).toMatchObject({ committed: true, pagesOn: true })
    expect(body.status.workflow).toMatchObject({ exists: true, current: true })
    expect(body.status.pages).toMatchObject({
      state: 'on',
      source: 'workflow',
      url: 'https://acme.github.io/site/',
    })
    expect(readFileSync(join(root, PAGES_WORKFLOW_PATH), 'utf8')).toBe(
      body.status.workflow.text
    )
    expect(
      execFileSync('git', ['log', '-1', '--format=%s'], { cwd: root })
        .toString()
        .trim()
    ).toBe('ci: deploy the site to GitHub Pages')
    expect(gh.calls).toContainEqual([
      'api',
      '-X',
      'POST',
      'repos/acme/site/pages',
      '-f',
      'build_type=workflow',
    ])

    // A second run changes nothing.
    const again = await (
      await app().request('/api/_pluto/github/deploy/pages', POST_LOCAL)
    ).json()
    expect(again.committed).toBe(false)
    expect(again.pagesOn).toBe(true)
  })

  it('moves a branch site to GitHub Actions', async () => {
    gh.pages = {
      build_type: 'legacy',
      html_url: 'https://acme.github.io/site/',
    }
    await app().request('/api/_pluto/github/deploy/pages', POST_LOCAL)
    expect(gh.calls.some((args) => args.includes('PUT'))).toBe(true)
  })

  it('still writes the workflow when gh is missing', async () => {
    gh.installed = false
    const body = await (
      await app().request('/api/_pluto/github/deploy/pages', POST_LOCAL)
    ).json()
    expect(body).toMatchObject({ committed: true, pagesOn: false })
    expect(body.status.pages).toEqual({ state: 'unknown', reason: 'no-gh' })
    expect(existsSync(join(root, PAGES_WORKFLOW_PATH))).toBe(true)
  })

  it('tells when gh is not signed in', async () => {
    gh.signedIn = false
    const body = await (
      await app().request('/api/_pluto/github/deploy/status', LOCAL)
    ).json()
    expect(body.pages).toEqual({ state: 'unknown', reason: 'signed-out' })
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

  describe('the custom domain', () => {
    function postDomain(body: object) {
      return app().request('/api/_pluto/github/deploy/domain', {
        ...POST_LOCAL,
        body,
      })
    }

    beforeEach(() => {
      gh.pages = {
        build_type: 'workflow',
        html_url: 'https://acme.github.io/site/',
        cname: null,
      }
    })

    it('gives the host and the domain in the status', async () => {
      resetTestConfig(undefined, {
        dev: true,
        storage: 'fs',
        fsRoot: root,
        host: 'netlify',
        hostSite: 'acme',
      })
      gh.pages!.cname = 'blog.acme.com'
      gh.pages!.https_certificate = { state: 'issued' }
      const body = await (
        await app().request('/api/_pluto/github/deploy/status', LOCAL)
      ).json()
      expect(body.host).toEqual({ id: 'netlify', site: 'acme' })
      expect(body.pages).toMatchObject({
        cname: 'blog.acme.com',
        certificate: 'issued',
        httpsEnforced: false,
      })
    })

    it('sets the domain, then builds the site again', async () => {
      const response = await postDomain({ domain: 'https://Blog.Acme.com/' })
      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.rebuilt).toBe(true)
      expect(body.status.pages.cname).toBe('blog.acme.com')
      expect(gh.calls).toContainEqual([
        'api',
        '-X',
        'PUT',
        'repos/acme/site/pages',
        '-F',
        'cname=blog.acme.com',
      ])
      expect(gh.calls).toContainEqual([
        'workflow',
        'run',
        'pluto-pages.yml',
        '-R',
        'acme/site',
        '--ref',
        'main',
      ])
    })

    it('tells to push when the workflow is not on GitHub yet', async () => {
      gh.workflowOnGithub = false
      const body = await (await postDomain({ domain: 'blog.acme.com' })).json()
      expect(body.rebuilt).toBe(false)
      expect(body.status.pages.cname).toBe('blog.acme.com')
    })

    it('removes the domain with null', async () => {
      gh.pages!.cname = 'blog.acme.com'
      const body = await (await postDomain({ domain: '' })).json()
      expect(body.status.pages.cname).toBe('')
      expect(gh.calls).toContainEqual([
        'api',
        '-X',
        'PUT',
        'repos/acme/site/pages',
        '-F',
        'cname=null',
      ])
    })

    it('turns Enforce HTTPS on, and builds nothing', async () => {
      gh.pages!.cname = 'blog.acme.com'
      const body = await (await postDomain({ httpsEnforced: true })).json()
      expect(body.rebuilt).toBe(false)
      expect(body.status.pages.httpsEnforced).toBe(true)
      expect(gh.calls.some((args) => args[0] === 'workflow')).toBe(false)
    })

    it('refuses a value that is not a domain', async () => {
      const response = await postDomain({ domain: 'not a domain' })
      expect(response.status).toBe(400)
      expect((await response.json()).data.i18n.key).toBe(
        'pluto.github.deploy.domain.errors.invalid'
      )
      expect(gh.calls.some((args) => args.includes('PUT'))).toBe(false)
    })

    it('tells when another site uses the domain', async () => {
      gh.takenDomain = 'blog.acme.com'
      const response = await postDomain({ domain: 'blog.acme.com' })
      expect(response.status).toBe(409)
      expect((await response.json()).data.i18n.key).toBe(
        'pluto.github.deploy.domain.errors.taken'
      )
    })

    it('needs GitHub Pages on', async () => {
      gh.pages = null
      const response = await postDomain({ domain: 'blog.acme.com' })
      expect(response.status).toBe(409)
      expect((await response.json()).data.i18n.key).toBe(
        'pluto.github.deploy.domain.errors.pagesOff'
      )
    })

    it('is a local mode route', async () => {
      resetTestConfig(undefined, { dev: false, storage: 'fs', fsRoot: root })
      const response = await postDomain({ domain: 'blog.acme.com' })
      expect(response.status).toBe(404)
    })
  })
})

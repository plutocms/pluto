import { describe, expect, it, vi } from 'vitest'
import {
  githubGraphql,
  githubRest,
  graphqlUrl,
} from '../modules/pluto-github/runtime/server/github/client'
import { createGithubStore } from '../modules/pluto-github/runtime/server/store/github'
import {
  PlutoGithubConflictError,
  PlutoGithubStoreError,
} from '../modules/pluto-github/runtime/server/store/types'
import { createGithubCache } from '../modules/pluto-github/runtime/server/utils/github-cache'
import { createFakeGithub } from './fixtures/fake-github'

const auth = { token: 'token' }

function setup(
  options: {
    headTtl?: number
    files?: Record<string, string>
    binary?: string[]
    truncated?: string[]
  } = {}
) {
  const github = createFakeGithub({
    files: options.files ?? {
      'content/posts/a.md': 'A',
      'content/posts/b.md': 'B',
      'content/other/x.md': 'X',
    },
    binary: options.binary,
    truncated: options.truncated,
  })
  const clock = { now: 1_000_000 }
  const cache = createGithubCache({
    headTtl: options.headTtl ?? 60,
    now: () => clock.now,
  })
  const store = createGithubStore({
    repo: github.repo,
    branch: github.branch,
    apiUrl: 'https://api.github.com',
    cache,
    readToken: 'read',
    fetch: github.fetch,
  })
  return { github, clock, store }
}

describe('github store listTree', () => {
  const files = {
    'content/index.md': 'I',
    'content/1.a/index.md': 'AI',
    'content/1.a/2.b/c.md': 'C',
    'content/1.a/note.txt': 'T',
    'content/.hidden/h.md': 'H',
    'other/o.md': 'O',
  }

  it('reads the whole tree with one nested GraphQL query', async () => {
    const queries: string[] = []
    const github = createFakeGithub({ files })
    const store = createGithubStore({
      repo: github.repo,
      branch: github.branch,
      apiUrl: 'https://api.github.com',
      cache: createGithubCache({ headTtl: 60 }),
      readToken: 'read',
      fetch: async (url, init) => {
        const body = JSON.parse(init.body ?? '{}') as {
          query?: string
        }
        if (body.query) {
          queries.push(body.query)
        }
        return github.fetch(url, init)
      },
    })

    const tree = await store.listTree('content', await store.head(), auth)

    expect(tree.map((file) => file.path)).toEqual([
      'content/1.a/2.b/c.md',
      'content/1.a/index.md',
      'content/index.md',
    ])
    expect(tree[0]).toMatchObject({ name: 'c.md', text: 'C' })
    expect(github.calls.tree).toBe(1)
    // The query nests `entries` six levels deep.
    expect(queries[0]!.match(/entries \{/g)).toHaveLength(6)
  })

  it('caches the tree by dir and head, and reads again after a new head', async () => {
    const { github, store } = setup({ files })
    const head = await store.head()

    await store.listTree('content', head, auth)
    await store.listTree('content/', head, auth)
    expect(github.calls.tree).toBe(1)

    github.push('content/new.md', 'N')
    const next = await store.head({ revalidate: true })
    const tree = await store.listTree('content', next, auth)
    expect(tree.map((file) => file.name)).toContain('new.md')
    expect(github.calls.tree).toBe(2)
  })

  it('gives an empty list for a missing dir', async () => {
    const { store } = setup({ files })

    expect(
      await store.listTree('content/none', await store.head(), auth)
    ).toEqual([])
  })
})

describe('github store head', () => {
  it('caches the head for the TTL', async () => {
    const { github, store } = setup()

    const first = await store.head()
    const second = await store.head()

    expect(first).toBe(github.head)
    expect(second).toBe(first)
    expect(github.calls.head).toBe(1)
    expect(github.calls.headNotModified).toBe(0)
  })

  it('revalidates with the ETag after the TTL, and a 304 returns the cached head', async () => {
    const { github, clock, store } = setup()
    const first = await store.head()

    clock.now += 61_000
    expect(await store.head()).toBe(first)
    expect(github.calls.headNotModified).toBe(1)

    // The 304 refreshed the TTL.
    await store.head()
    expect(github.calls.headNotModified).toBe(1)
  })

  it('skips the TTL with revalidate and sees a new head', async () => {
    const { github, store } = setup()
    const first = await store.head()
    const pushed = github.push('content/posts/c.md', 'C')

    expect(await store.head()).toBe(first)
    expect(await store.head({ revalidate: true })).toBe(pushed)
    expect(github.calls.head).toBe(2)
  })

  it('dedupes concurrent head calls', async () => {
    const { github, store } = setup()
    github.setDelay(10)

    const heads = await Promise.all([store.head(), store.head(), store.head()])

    expect(new Set(heads).size).toBe(1)
    expect(github.calls.head).toBe(1)
  })
})

describe('github store listDir', () => {
  it('lists the .md blobs, sorted, with one GraphQL call and a cache hit after', async () => {
    const { github, store } = setup()
    const head = await store.head()

    const files = await store.listDir('content/posts', head, auth)

    expect(files).toEqual([
      expect.objectContaining({
        path: 'content/posts/a.md',
        name: 'a.md',
        text: 'A',
      }),
      expect.objectContaining({
        path: 'content/posts/b.md',
        name: 'b.md',
        text: 'B',
      }),
    ])
    expect(files[0]!.oid).toHaveLength(40)
    expect(github.calls.graphql).toBe(1)

    await store.listDir('content/posts', head, auth)
    expect(github.calls.graphql).toBe(1)
  })

  it('dedupes concurrent identical lists', async () => {
    const { github, store } = setup()
    const head = await store.head()
    github.setDelay(10)

    const lists = await Promise.all([
      store.listDir('content/posts', head),
      store.listDir('content/posts', head),
    ])

    expect(lists[0]).toEqual(lists[1])
    expect(github.calls.graphql).toBe(1)
  })

  it('skips binary and truncated blobs with a warning, and non-md files', async () => {
    const { store } = setup({
      files: {
        'content/posts/a.md': 'A',
        'content/posts/bin.md': 'bin',
        'content/posts/big.md': 'big',
        'content/posts/img.png': 'png',
      },
      binary: ['content/posts/bin.md'],
      truncated: ['content/posts/big.md'],
    })
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const files = await store.listDir('content/posts', await store.head())

    expect(files.map((file) => file.name)).toEqual(['a.md'])
    expect(warn).toHaveBeenCalledTimes(2)
    warn.mockRestore()
  })

  it('gives an empty list for a missing dir', async () => {
    const { store } = setup()

    expect(await store.listDir('content/none', await store.head())).toEqual([])
  })
})

describe('github store readFile', () => {
  it('reads from the cached index with no extra call', async () => {
    const { github, store } = setup()
    const head = await store.head()
    await store.listDir('content/posts', head)

    expect((await store.readFile('content/posts/a.md', head))?.text).toBe('A')
    expect(await store.readFile('content/posts/missing.md', head)).toBeNull()
    expect(github.calls.graphql).toBe(1)
  })

  it('queries the blob when the dir is not cached', async () => {
    const { github, store } = setup()
    const head = await store.head()

    const file = await store.readFile('content/posts/a.md', head)

    expect(file).toMatchObject({
      path: 'content/posts/a.md',
      name: 'a.md',
      text: 'A',
    })
    expect(github.calls.blob).toBe(1)
    expect(await store.readFile('content/posts/none.md', head)).toBeNull()
  })
})

describe('github store commit', () => {
  it('commits, returns the new head and caches it at once', async () => {
    const { github, store } = setup()
    const head = await store.head()

    const { oid } = await store.commit(
      {
        expectedHeadOid: head,
        message: 'feat: add\n\nBody text',
        additions: [{ path: 'content/posts/c.md', contents: 'café' }],
        deletions: [{ path: 'content/posts/a.md' }],
      },
      auth
    )

    expect(oid).toBe(github.head)
    expect(github.read('content/posts/c.md')).toBe('café')
    expect(github.read('content/posts/a.md')).toBeUndefined()

    const headCalls = github.calls.head
    expect(await store.head()).toBe(oid)
    expect(github.calls.head).toBe(headCalls)
    expect(
      (await store.listDir('content/posts', oid)).map((file) => file.name)
    ).toEqual(['b.md', 'c.md'])
  })

  it('throws a conflict error for a stale head', async () => {
    const { github, store } = setup()
    const head = await store.head()
    github.push('content/posts/z.md', 'Z')

    await expect(
      store.commit(
        {
          expectedHeadOid: head,
          message: 'late',
          additions: [{ path: 'content/posts/c.md', contents: 'C' }],
          deletions: [],
        },
        auth
      )
    ).rejects.toBeInstanceOf(PlutoGithubConflictError)
    expect(github.read('content/posts/c.md')).toBeUndefined()
  })

  it('needs a token', async () => {
    const { store } = setup()

    await expect(
      store.commit(
        {
          expectedHeadOid: await store.head(),
          message: 'm',
          additions: [],
          deletions: [],
        },
        { token: '' }
      )
    ).rejects.toMatchObject({ code: 'auth' })
  })
})

describe('github client errors', () => {
  it('types a 401, 404 and other failures', async () => {
    const { github } = setup()

    github.failNext({ status: 401, body: { message: 'Bad credentials' } })
    await expect(
      githubRest('/x', { fetch: github.fetch })
    ).rejects.toMatchObject({ code: 'auth', status: 401 })

    github.failNext({ status: 404, body: { message: 'Not Found' } })
    await expect(
      githubRest('/x', { fetch: github.fetch })
    ).rejects.toMatchObject({ code: 'not-found' })

    github.failNext({ status: 500 })
    await expect(
      githubRest('/x', { fetch: github.fetch })
    ).rejects.toMatchObject({ code: 'github', status: 500 })

    github.failNext({
      status: 403,
      body: { message: 'Resource not accessible' },
    })
    await expect(
      githubRest('/x', { fetch: github.fetch })
    ).rejects.toMatchObject({ code: 'forbidden' })
  })

  it('types a rate limit and reads retry-after', async () => {
    const { github } = setup()

    github.failNext({ status: 429, headers: { 'Retry-After': '30' } })
    const error = await githubRest('/x', { fetch: github.fetch }).catch(
      (caught) => caught
    )

    expect(error).toBeInstanceOf(PlutoGithubStoreError)
    expect(error).toMatchObject({ code: 'rate-limit', retryAfter: 30 })
  })

  it('types a 403 rate limit from the reset header', async () => {
    const { github } = setup()
    const reset = Math.floor(Date.now() / 1000) + 120

    github.failNext({
      status: 403,
      headers: {
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': String(reset),
      },
      body: { message: 'API rate limit exceeded' },
    })
    const error = await githubRest('/x', { fetch: github.fetch }).catch(
      (caught) => caught
    )

    expect(error.code).toBe('rate-limit')
    expect(error.retryAfter).toBeGreaterThan(100)
    expect(error.retryAfter).toBeLessThanOrEqual(120)
  })

  it('types GraphQL errors', async () => {
    const { github } = setup()
    const stub = (type: string, message: string) =>
      github.failNext({ status: 200, body: { errors: [{ type, message }] } })

    stub('RATE_LIMITED', 'API rate limit exceeded')
    await expect(
      githubGraphql('q', {}, { fetch: github.fetch })
    ).rejects.toMatchObject({ code: 'rate-limit' })

    stub('NOT_FOUND', 'Could not resolve')
    await expect(
      githubGraphql('q', {}, { fetch: github.fetch })
    ).rejects.toMatchObject({ code: 'not-found' })

    stub('STALE_DATA', 'Expected branch to point to "x"')
    await expect(
      githubGraphql('q', {}, { fetch: github.fetch })
    ).rejects.toBeInstanceOf(PlutoGithubConflictError)

    stub('OTHER', 'The expectedHeadOid is not the latest')
    await expect(
      githubGraphql('q', {}, { fetch: github.fetch })
    ).rejects.toBeInstanceOf(PlutoGithubConflictError)

    stub('OTHER', 'Something else')
    await expect(
      githubGraphql('q', {}, { fetch: github.fetch })
    ).rejects.toMatchObject({ code: 'github' })
  })

  it('sends the standard headers', async () => {
    const seen: Record<string, string>[] = []
    await githubRest('/x', {
      token: 'tok',
      fetch: async (_url, init) => {
        seen.push(init.headers)
        return { status: 200, headers: { get: () => null }, data: {} }
      },
    })

    expect(seen[0]).toMatchObject({
      Authorization: 'Bearer tok',
      'User-Agent': 'plutocms',
      'X-GitHub-Api-Version': '2022-11-28',
    })
  })

  it('finds the GraphQL url for github.com and for Enterprise', () => {
    expect(graphqlUrl('https://api.github.com')).toBe(
      'https://api.github.com/graphql'
    )
    expect(graphqlUrl('https://ghe.example.com/api/v3/')).toBe(
      'https://ghe.example.com/api/graphql'
    )
  })
})

import type { H3Event } from 'h3'
import type { PlutoGithubAccess } from '../modules/pluto-github/runtime/server/adapter'
import type { PlutoGithubStore } from '../modules/pluto-github/runtime/server/store/types'
import type {
  ContractCaller,
  ContractHarness,
} from './contracts/content-adapter.contract'
import { describe, expect, it, vi } from 'vitest'
import { createMarkdownContentAdapter } from '../modules/pluto-github/runtime/server/adapter'
import { createGithubStore } from '../modules/pluto-github/runtime/server/store/github'
import { createMemoryStore } from '../modules/pluto-github/runtime/server/store/memory'
import { createGithubCache } from '../modules/pluto-github/runtime/server/utils/github-cache'
import { parseMarkdownFile } from '../modules/pluto-github/runtime/server/utils/markdown-file'
import { plutoGithubPostType } from '../modules/pluto-github/runtime/shared/post-type'
import {
  createContractClock,
  runContentAdapterContract,
} from './contracts/content-adapter.contract'
import { createFakeGithub } from './fixtures/fake-github'

const type = plutoGithubPostType
const event = {} as H3Event
const ctx = { event, type }
const EDITOR = ['posts:read_drafts', 'posts:publish', 'posts:delete']

function harnessFor(
  store: PlutoGithubStore,
  clock: () => Date,
  extra: {
    skipDeploy?: boolean
  } = {}
) {
  let caller: ContractCaller = { capabilities: EDITOR }
  const adapter = createMarkdownContentAdapter({
    store,
    dir: 'content',
    commit: { skipDeploy: extra.skipDeploy },
    now: clock,
    getAccess: async (): Promise<PlutoGithubAccess | null> =>
      caller
        ? { capabilities: caller.capabilities, auth: { token: 't' } }
        : null,
  })
  const harness: ContractHarness = {
    adapter,
    as: (next) => {
      caller = next
    },
  }
  return harness
}

function githubStore(files: Record<string, string> = {}) {
  const github = createFakeGithub({ files })
  const store = createGithubStore({
    repo: github.repo,
    branch: github.branch,
    apiUrl: 'https://api.github.com',
    cache: createGithubCache({ headTtl: 60 }),
    fetch: github.fetch,
  })
  return { github, store }
}

runContentAdapterContract(
  'markdown over the memory store',
  async (clock) => harnessFor(createMemoryStore(), clock),
  { type }
)

runContentAdapterContract(
  'markdown over the github store',
  async (clock) => harnessFor(githubStore().store, clock),
  { type }
)

describe('markdown adapter', () => {
  it('stores the mapped fields as frontmatter and the richtext field as the body', async () => {
    const { github, store } = githubStore()
    const { adapter } = harnessFor(store, createContractClock())

    await adapter.create(ctx, {
      title: 'Hello',
      slug: 'hello',
      excerpt: 'Short',
      content: '# Body\n',
      status: 'draft',
    })
    const parsed = parseMarkdownFile(github.read('content/posts/hello.md')!)

    expect(Object.keys(parsed.frontmatter)).toEqual([
      'title',
      'excerpt',
      'status',
      'createdAt',
      'updatedAt',
    ])
    expect(parsed.frontmatter).toMatchObject({
      title: 'Hello',
      excerpt: 'Short',
      status: 'draft',
      createdAt: '2026-03-01T00:01:00.000Z',
    })
    expect(parsed.frontmatter.slug).toBeUndefined()
    expect(parsed.body).toBe('# Body\n')
  })

  it('reads a hand-written file and keeps unknown frontmatter keys on update', async () => {
    const text =
      '---\ntitle: Old\nstatus: published\ntags:\n  - a\n  - b\ncustom:\n  nested: 1\ncreatedAt: 2026-01-01T00:00:00.000Z\n---\nText\n'
    const { github, store } = githubStore({ 'content/posts/old.md': text })
    const { adapter } = harnessFor(store, createContractClock())

    await adapter.update(ctx, 'old', { title: 'New' })
    const parsed = parseMarkdownFile(github.read('content/posts/old.md')!)

    expect(parsed.frontmatter).toMatchObject({
      title: 'New',
      tags: ['a', 'b'],
      custom: { nested: 1 },
      status: 'published',
    })
    expect(parsed.body).toBe('Text\n')
  })

  it('sets publishedAt on the first publish only', async () => {
    const { github, store } = githubStore()
    const { adapter } = harnessFor(store, createContractClock())
    const read = () =>
      parseMarkdownFile(github.read('content/posts/hello.md')!).frontmatter

    await adapter.create(ctx, { title: 'Hello' })
    expect(read().publishedAt).toBeUndefined()

    await adapter.update(ctx, 'hello', { status: 'published' })
    const first = read().publishedAt
    expect(typeof first).toBe('string')

    await adapter.update(ctx, 'hello', { status: 'draft' })
    await adapter.update(ctx, 'hello', { status: 'published' })
    expect(read().publishedAt).toBe(first)
  })

  it('does not let a payload set the timestamps', async () => {
    const store = createMemoryStore()
    const { adapter } = harnessFor(store, createContractClock())

    await adapter.create(ctx, {
      title: 'Hello',
      createdAt: '1999-01-01T00:00:00Z',
      updatedAt: '1999-01-01T00:00:00Z',
    })
    const file = await store.readFile(
      'content/posts/hello.md',
      await store.head()
    )

    expect(parseMarkdownFile(file!.text).frontmatter.createdAt).toBe(
      '2026-03-01T00:01:00.000Z'
    )
  })

  it('writes the commit messages, with the skip marker when asked', async () => {
    const messages: string[] = []
    const memory = createMemoryStore()
    const store: PlutoGithubStore = {
      ...memory,
      commit: async (input, auth) => {
        messages.push(input.message)
        return memory.commit(input, auth)
      },
    }
    const { adapter } = harnessFor(store, createContractClock(), {
      skipDeploy: true,
    })

    await adapter.create(ctx, { title: 'Hello' })
    await adapter.update(ctx, 'hello', { title: 'Hello 2' })
    await adapter.update(ctx, 'hello', { status: 'published' })
    await adapter.update(ctx, 'hello', { status: 'draft' })
    await adapter.update(ctx, 'hello', { slug: 'bye' })
    await adapter.remove(ctx, 'bye')

    expect(messages).toEqual([
      'content(post): create "hello" [skip ci]',
      'content(post): update "hello" [skip ci]',
      'content(post): publish "hello" [skip ci]',
      'content(post): unpublish "hello" [skip ci]',
      'content(post): rename "hello" -> "bye" [skip ci]',
      'content(post): delete "bye" [skip ci]',
    ])
  })

  it('leaves out the skip marker by default', async () => {
    const messages: string[] = []
    const memory = createMemoryStore()
    const store: PlutoGithubStore = {
      ...memory,
      commit: async (input, auth) => {
        messages.push(input.message)
        return memory.commit(input, auth)
      },
    }

    await harnessFor(store, createContractClock()).adapter.create(ctx, {
      title: 'Hello',
    })

    expect(messages).toEqual(['content(post): create "hello"'])
  })

  it('skips a file with invalid frontmatter and keeps the rest', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { store } = githubStore({
      'content/posts/bad.md': '---\ntitle: [unclosed\n---\n',
      'content/posts/good.md': '---\ntitle: Good\nstatus: published\n---\n',
    })
    const { adapter } = harnessFor(store, createContractClock())

    expect((await adapter.list(ctx, {})).data.map((item) => item.id)).toEqual([
      'good',
    ])
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })

  it('parses an unchanged file once', async () => {
    const { github, store } = githubStore({
      'content/posts/a.md': '---\ntitle: A\nstatus: published\n---\n',
    })
    const cache = createGithubCache({ headTtl: 60 })
    const getBlob = vi.spyOn(cache, 'setBlob')
    const adapter = createMarkdownContentAdapter({
      store,
      dir: 'content',
      cache,
      getAccess: async () => null,
    })

    await adapter.list(ctx, {})
    github.push('content/posts/b.md', '---\ntitle: B\nstatus: published\n---\n')
    await store.head({ revalidate: true })
    await adapter.list(ctx, {})

    // One call for `a.md`, one for `b.md`. `a.md` is not parsed again.
    expect(getBlob).toHaveBeenCalledTimes(2)
  })
})

describe('markdown adapter commit conflicts', () => {
  function withHook(store: PlutoGithubStore) {
    const state: {
      before?: () => void
      commits: number
    } = { commits: 0 }
    const wrapped: PlutoGithubStore = {
      ...store,
      commit: async (input, auth) => {
        state.commits++
        const hook = state.before
        state.before = undefined
        hook?.()
        return store.commit(input, auth)
      },
    }
    return { wrapped, state }
  }

  it('retries and succeeds when an unrelated file changed', async () => {
    const { github, store } = githubStore({
      'content/posts/a.md': '---\ntitle: A\n---\nBody\n',
    })
    const { wrapped, state } = withHook(store)
    const { adapter } = harnessFor(wrapped, createContractClock())
    state.before = () =>
      github.push('content/posts/other.md', '---\ntitle: Other\n---\n')

    const saved = await adapter.update(ctx, 'a', { title: 'A2' })

    expect(saved.title).toBe('A2')
    expect(state.commits).toBe(2)
    expect(github.read('content/posts/other.md')).toBeDefined()
    expect(
      parseMarkdownFile(github.read('content/posts/a.md')!).frontmatter.title
    ).toBe('A2')
  })

  it('answers 409 when the same file changed', async () => {
    const { github, store } = githubStore({
      'content/posts/a.md': '---\ntitle: A\n---\nBody\n',
    })
    const { wrapped, state } = withHook(store)
    const { adapter } = harnessFor(wrapped, createContractClock())
    state.before = () =>
      github.push(
        'content/posts/a.md',
        '---\ntitle: Changed elsewhere\n---\nBody\n'
      )

    await expect(
      adapter.update(ctx, 'a', { title: 'A2' })
    ).rejects.toMatchObject({ statusCode: 409 })
    expect(
      parseMarkdownFile(github.read('content/posts/a.md')!).frontmatter.title
    ).toBe('Changed elsewhere')
  })

  it('gives up with 409 after the retries', async () => {
    const { github, store } = githubStore({
      'content/posts/a.md': '---\ntitle: A\n---\n',
    })
    const { wrapped, state } = withHook(store)
    const { adapter } = harnessFor(wrapped, createContractClock())
    let counter = 0
    const commit = wrapped.commit
    wrapped.commit = async (input, auth) => {
      github.push(`content/posts/noise-${counter++}.md`, 'x')
      return commit(input, auth)
    }

    await expect(
      adapter.update(ctx, 'a', { title: 'A2' })
    ).rejects.toMatchObject({ statusCode: 409 })
    expect(state.commits).toBe(3)
  })
})

describe('markdown adapter store errors', () => {
  it('maps a rate limit to 503 with Retry-After', async () => {
    const { github, store } = githubStore()
    const setHeader = vi.fn()
    const rateEvent = {
      node: { req: {}, res: { setHeader } },
    } as unknown as H3Event
    const { adapter } = harnessFor(store, createContractClock())
    github.failNext({ status: 429, headers: { 'Retry-After': '30' } })

    await expect(
      adapter.list({ event: rateEvent, type }, {})
    ).rejects.toMatchObject({
      statusCode: 503,
      data: {
        i18n: { key: 'pluto.github.errors.rateLimited' },
        retryAfter: 30,
      },
    })
    expect(setHeader).toHaveBeenCalledWith('Retry-After', 30)
  })

  it('maps GitHub auth, forbidden and server errors', async () => {
    const { github, store } = githubStore()
    const { adapter } = harnessFor(store, createContractClock())

    github.failNext({ status: 401, body: { message: 'Bad credentials' } })
    await expect(adapter.list(ctx, {})).rejects.toMatchObject({
      statusCode: 401,
      data: { i18n: { key: 'pluto.github.errors.githubAuth' } },
    })

    github.failNext({
      status: 403,
      body: { message: 'Resource not accessible' },
    })
    await expect(adapter.list(ctx, {})).rejects.toMatchObject({
      statusCode: 403,
    })

    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    github.failNext({ status: 500 })
    await expect(adapter.list(ctx, {})).rejects.toMatchObject({
      statusCode: 502,
    })
    error.mockRestore()
  })
})

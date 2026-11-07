import type { H3Event } from 'h3'
import type { PlutoGithubAccess } from '../modules/pluto-github/runtime/server/adapter'
import type { PlutoGithubStore } from '../modules/pluto-github/runtime/server/store/types'
import { describe, expect, it } from 'vitest'
import { createMarkdownContentAdapter } from '../modules/pluto-github/runtime/server/adapter'
import { createGithubStore } from '../modules/pluto-github/runtime/server/store/github'
import { createGithubCache } from '../modules/pluto-github/runtime/server/utils/github-cache'
import { parseMarkdownFile } from '../modules/pluto-github/runtime/server/utils/markdown-file'
import { plutoGithubAuthorType } from '../modules/pluto-github/runtime/shared/author-type'
import { plutoGithubPostType } from '../modules/pluto-github/runtime/shared/post-type'
import {
  plutoGithubCategoryType,
  plutoGithubTagType,
  plutoGithubTermTypes,
} from '../modules/pluto-github/runtime/shared/term-types'
import { createContractClock } from './contracts/content-adapter.contract'
import { createFakeGithub } from './fixtures/fake-github'

const event = {} as H3Event
const post = { event, type: plutoGithubPostType }
const tag = { event, type: plutoGithubTagType }
const category = { event, type: plutoGithubCategoryType }
const author = { event, type: plutoGithubAuthorType }
const EDITOR = [
  'posts:read_drafts',
  'posts:publish',
  'posts:delete',
  'terms:manage',
  'authors:manage',
]

const STAMP = '2026-01-01T00:00:00.000Z'

function file(frontmatter: string, body = 'Body\n') {
  return `---\n${frontmatter}\n---\n${body}`
}

function setup(files: Record<string, string>) {
  const github = createFakeGithub({ files })
  const base = createGithubStore({
    repo: github.repo,
    branch: github.branch,
    apiUrl: 'https://api.github.com',
    cache: createGithubCache({ headTtl: 60 }),
    fetch: github.fetch,
  })
  const state: {
    before?: () => void
    commits: Array<{
      message: string
      additions: string[]
      deletions: string[]
    }>
  } = { commits: [] }
  const store: PlutoGithubStore = {
    ...base,
    commit: async (input, auth) => {
      const hook = state.before
      state.before = undefined
      hook?.()
      state.commits.push({
        message: input.message,
        additions: input.additions.map((entry) => entry.path),
        deletions: input.deletions.map((entry) => entry.path),
      })
      return base.commit(input, auth)
    },
  }
  const adapter = createMarkdownContentAdapter({
    store,
    dir: 'content',
    now: createContractClock(),
    getTypes: () => [
      plutoGithubPostType,
      ...plutoGithubTermTypes,
      plutoGithubAuthorType,
    ],
    getAccess: async (): Promise<PlutoGithubAccess | null> => ({
      capabilities: EDITOR,
      auth: { token: 't' },
    }),
  })
  return { github, adapter, state }
}

const read = (github: ReturnType<typeof setup>['github'], path: string) =>
  parseMarkdownFile(github.read(path)!)

describe('ids and list membership', () => {
  const files = {
    'content/posts/one.md': file(
      'title: One\nstatus: published\ntags:\n  - a\n  - b'
    ),
    'content/posts/two.md': file('title: Two\nstatus: published\ntags:\n  - b'),
    'content/posts/three.md': file('title: Three\nstatus: published'),
  }

  it('lists the items with the given ids', async () => {
    const { adapter } = setup(files)
    const result = await adapter.list(post, { ids: ['one', 'three', 'none'] })
    expect(result.data.map((item) => item.id).sort()).toEqual(['one', 'three'])
    expect(result.total).toBe(2)
  })

  it('gives no item for an empty ids list', async () => {
    const { adapter } = setup(files)
    const result = await adapter.list(post, { ids: [] })
    expect(result.data).toEqual([])
  })

  it('matches a filter when a list has the value', async () => {
    const { adapter } = setup(files)
    const hasB = await adapter.list(post, { filters: { tags: 'b' } })
    expect(hasB.data.map((item) => item.id).sort()).toEqual(['one', 'two'])
    const hasA = await adapter.list(post, { filters: { tags: 'a' } })
    expect(hasA.data.map((item) => item.id)).toEqual(['one'])
    const none = await adapter.list(post, { filters: { tags: 'a,b' } })
    expect(none.data).toEqual([])
  })
})

describe('empty lists', () => {
  it('leaves the key out of the frontmatter', async () => {
    const { github, adapter } = setup({
      'content/posts/one.md': file('title: One\ntags:\n  - a\ncustom: 1'),
    })
    await adapter.update(post, 'one', { tags: [] })
    const frontmatter = read(github, 'content/posts/one.md').frontmatter
    expect(frontmatter).not.toHaveProperty('tags')
    expect(frontmatter.custom).toBe(1)
  })

  it('does not write an empty list on create', async () => {
    const { github, adapter } = setup({})
    await adapter.create(post, { title: 'Hello', tags: [], categories: ['x'] })
    const frontmatter = read(github, 'content/posts/hello.md').frontmatter
    expect(frontmatter).not.toHaveProperty('tags')
    expect(frontmatter.categories).toEqual(['x'])
  })
})

describe('a rename or a delete of a term', () => {
  const files = {
    'content/tags/a.md': file('title: A', ''),
    'content/tags/b.md': file('title: B', ''),
    'content/categories/a.md': file('title: Cat A', ''),
    'content/posts/live.md': file(
      `title: Live\nstatus: published\ntags:\n  - x\n  - a\ncategories:\n  - a\ncustom:\n  nested: 1\ncreatedAt: ${STAMP}\nupdatedAt: ${STAMP}`,
      '# Heading\n\nText.\n'
    ),
    'content/posts/draft.md': file(
      `title: Draft\nstatus: draft\ntags:\n  - a\nupdatedAt: ${STAMP}`,
      'Draft text\n'
    ),
    'content/posts/both.md': file(
      `title: Both\nstatus: published\ntags:\n  - a\n  - b\nupdatedAt: ${STAMP}`
    ),
    'content/posts/other.md': file(
      `title: Other\nstatus: published\ntags:\n  - x\nupdatedAt: ${STAMP}`
    ),
  }

  it('renames in the referencing posts, drafts too, in one commit', async () => {
    const { github, adapter, state } = setup(files)
    const before = {
      live: github.read('content/posts/live.md'),
      other: github.read('content/posts/other.md'),
      category: github.read('content/categories/a.md'),
    }

    await adapter.update(tag, 'a', { slug: 'alpha' })

    expect(state.commits).toHaveLength(1)
    const commit = state.commits[0]!
    expect(commit.message).toBe(
      'content(tag): rename "a" -> "alpha" (3 references)'
    )
    expect(commit.deletions).toEqual(['content/tags/a.md'])
    expect(commit.additions.sort()).toEqual([
      'content/posts/both.md',
      'content/posts/draft.md',
      'content/posts/live.md',
      'content/tags/alpha.md',
    ])

    const live = read(github, 'content/posts/live.md')
    expect(live.frontmatter.tags).toEqual(['x', 'alpha'])
    expect(live.frontmatter.categories).toEqual(['a'])
    expect(live.frontmatter.custom).toEqual({ nested: 1 })
    expect(live.frontmatter.updatedAt).toBe(STAMP)
    expect(live.body).toBe('# Heading\n\nText.\n')
    const draft = read(github, 'content/posts/draft.md')
    expect(draft.frontmatter.tags).toEqual(['alpha'])
    expect(draft.frontmatter.status).toBe('draft')
    expect(draft.body).toBe('Draft text\n')
    expect(read(github, 'content/posts/both.md').frontmatter.tags).toEqual([
      'alpha',
      'b',
    ])
    // A post with no reference and a term of another type stay as they were.
    expect(github.read('content/posts/other.md')).toBe(before.other)
    expect(github.read('content/categories/a.md')).toBe(before.category)
    expect(before.live).not.toBe(github.read('content/posts/live.md'))
  })

  it('does not rewrite on a save without a rename', async () => {
    const { github, adapter, state } = setup(files)
    const live = github.read('content/posts/live.md')
    await adapter.update(tag, 'a', { title: 'A2' })
    expect(state.commits[0]!.additions).toEqual(['content/tags/a.md'])
    expect(state.commits[0]!.message).toBe('content(tag): update "a"')
    expect(github.read('content/posts/live.md')).toBe(live)
  })

  it('drops the id on delete, and the key when the list ends empty', async () => {
    const { github, adapter, state } = setup(files)

    await adapter.remove(tag, 'a')

    expect(state.commits).toHaveLength(1)
    expect(state.commits[0]!.message).toBe(
      'content(tag): delete "a" (3 references)'
    )
    expect(state.commits[0]!.deletions).toEqual(['content/tags/a.md'])
    expect(github.read('content/tags/a.md')).toBeUndefined()
    expect(read(github, 'content/posts/live.md').frontmatter.tags).toEqual([
      'x',
    ])
    const draft = read(github, 'content/posts/draft.md')
    expect(draft.frontmatter).not.toHaveProperty('tags')
    expect(draft.frontmatter.updatedAt).toBe(STAMP)
    expect(read(github, 'content/posts/both.md').frontmatter.tags).toEqual([
      'b',
    ])
    // The category with the same id keeps its posts.
    expect(
      read(github, 'content/posts/live.md').frontmatter.categories
    ).toEqual(['a'])
  })

  it('deletes a category the same way', async () => {
    const { github, adapter } = setup(files)
    await adapter.remove(category, 'a')
    const live = read(github, 'content/posts/live.md').frontmatter
    expect(live).not.toHaveProperty('categories')
    expect(live.tags).toEqual(['x', 'a'])
  })

  it('makes a plain commit for a term that no post uses', async () => {
    const { adapter, state } = setup(files)
    await adapter.create(tag, { title: 'Fresh' })
    await adapter.remove(tag, 'fresh')
    expect(state.commits.map((commit) => commit.message)).toEqual([
      'content(tag): create "fresh"',
      'content(tag): delete "fresh"',
    ])
  })

  it('answers 409 when a referencing file changed during the rename', async () => {
    const { github, adapter, state } = setup(files)
    state.before = () =>
      github.push(
        'content/posts/draft.md',
        file(`title: Draft edited\nstatus: draft\ntags:\n  - a`)
      )

    await expect(
      adapter.update(tag, 'a', { slug: 'alpha' })
    ).rejects.toMatchObject({ statusCode: 409 })
    expect(github.read('content/tags/a.md')).toBeDefined()
    expect(github.read('content/tags/alpha.md')).toBeUndefined()
  })
})

describe('a rename or a delete of an author', () => {
  const files = {
    'content/authors/ana.md': file('name: Ana\nbio: Writes.', ''),
    'content/authors/bo.md': file('name: Bo', ''),
    'content/posts/live.md': file(
      `title: Live\nstatus: published\nauthors:\n  - bo\n  - ana\nupdatedAt: ${STAMP}`
    ),
    'content/posts/draft.md': file(
      `title: Draft\nstatus: draft\nauthors:\n  - ana\nupdatedAt: ${STAMP}`
    ),
  }

  it('renames in the posts, drafts too, in one commit, and keeps the order', async () => {
    const { github, adapter, state } = setup(files)

    await adapter.update(author, 'ana', { slug: 'ana-lima' })

    expect(state.commits).toHaveLength(1)
    expect(state.commits[0]!.message).toBe(
      'content(author): rename "ana" -> "ana-lima" (2 references)'
    )
    expect(read(github, 'content/posts/live.md').frontmatter.authors).toEqual([
      'bo',
      'ana-lima',
    ])
    expect(read(github, 'content/posts/draft.md').frontmatter.authors).toEqual([
      'ana-lima',
    ])
    expect(read(github, 'content/authors/ana-lima.md').frontmatter.bio).toBe(
      'Writes.'
    )
  })

  it('drops the author on delete, and the key when no author is left', async () => {
    const { github, adapter } = setup(files)

    await adapter.remove(author, 'ana')

    expect(read(github, 'content/posts/live.md').frontmatter.authors).toEqual([
      'bo',
    ])
    expect(
      read(github, 'content/posts/draft.md').frontmatter
    ).not.toHaveProperty('authors')
  })
})

describe('the trash of a term', () => {
  const files = {
    'content/tags/a.md': file('title: A', ''),
    'content/tags/b.md': file('title: B', ''),
    'content/posts/live.md': file(
      `title: Live\nstatus: published\ntags:\n  - a\n  - b\nupdatedAt: ${STAMP}`
    ),
    'content/posts/draft.md': file(
      `title: Draft\nstatus: draft\ntags:\n  - a\nupdatedAt: ${STAMP}`
    ),
  }

  it('keeps the references in the trash, and moves the file in one commit', async () => {
    const { github, adapter, state } = setup(files)

    await adapter.trash!.move(tag, 'a')

    expect(state.commits).toHaveLength(1)
    expect(state.commits[0]).toMatchObject({
      message: 'content(tag): trash "a"',
      additions: ['content/.trash/tag/a.md'],
      deletions: ['content/tags/a.md'],
    })
    const trashed = read(github, 'content/.trash/tag/a.md').frontmatter
    expect(trashed.title).toBe('A')
    expect(typeof trashed.deletedAt).toBe('string')
    expect(read(github, 'content/posts/live.md').frontmatter.tags).toEqual([
      'a',
      'b',
    ])
    // The public answer drops a trashed target: it is not in the list of tags.
    expect(
      (await adapter.list(tag, { ids: ['a', 'b'] })).data.map((item) => item.id)
    ).toEqual(['b'])
  })

  it('restores the file without deletedAt, and the references are still there', async () => {
    const { github, adapter } = setup(files)
    await adapter.trash!.move(tag, 'a')

    await adapter.trash!.restore(tag, 'a')

    expect(github.read('content/.trash/tag/a.md')).toBeUndefined()
    expect(read(github, 'content/tags/a.md').frontmatter).toEqual({
      title: 'A',
    })
    expect(read(github, 'content/posts/live.md').frontmatter.tags).toEqual([
      'a',
      'b',
    ])
  })

  it('drops the references at the purge, drafts too, in one commit', async () => {
    const { github, adapter, state } = setup(files)
    await adapter.trash!.move(tag, 'a')

    await adapter.trash!.purge(tag, 'a')

    expect(state.commits.at(-1)).toMatchObject({
      message: 'content(tag): purge "a" (2 references)',
      deletions: ['content/.trash/tag/a.md'],
    })
    expect(read(github, 'content/posts/live.md').frontmatter.tags).toEqual([
      'b',
    ])
    expect(
      read(github, 'content/posts/draft.md').frontmatter
    ).not.toHaveProperty('tags')
  })

  it('keeps the references when a live item has the id again', async () => {
    const { github, adapter } = setup(files)
    await adapter.trash!.move(tag, 'a')
    await adapter.create(tag, { title: 'A', slug: 'a' })

    await adapter.trash!.purge(tag, 'a')

    expect(read(github, 'content/posts/live.md').frontmatter.tags).toEqual([
      'a',
      'b',
    ])
  })

  it('purges two terms in one commit, and one post loses both', async () => {
    const { github, adapter, state } = setup(files)
    await adapter.trash!.move(tag, 'a')
    await adapter.trash!.move(tag, 'b')

    expect(await adapter.trash!.purgeBefore(tag, '2999-01-01T00:00:00Z')).toBe(
      2
    )

    expect(state.commits.at(-1)!.message).toBe(
      'content(tag): purge 2 from the trash'
    )
    expect(
      read(github, 'content/posts/live.md').frontmatter
    ).not.toHaveProperty('tags')
    expect(await adapter.trash!.purgeBefore(tag, '2999-01-01T00:00:00Z')).toBe(
      0
    )
  })
})

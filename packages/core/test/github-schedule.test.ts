import type { H3Event } from 'h3'
import type { PlutoGithubAccess } from '../modules/pluto-github/runtime/server/adapter'
import type { PlutoContentType } from '../shared/types/content'
import { describe, expect, it } from 'vitest'
import { createMarkdownContentAdapter } from '../modules/pluto-github/runtime/server/adapter'
import { createMemoryStore } from '../modules/pluto-github/runtime/server/store/memory'
import { plutoGithubPostType } from '../modules/pluto-github/runtime/shared/post-type'

// A post type with a write capability apart from publish, and the review step: a writer can save
// drafts and send them to review, an editor publishes and schedules.
const type: PlutoContentType = {
  ...plutoGithubPostType,
  status: {
    ...(plutoGithubPostType.status as Exclude<
      PlutoContentType['status'],
      false | undefined
    >),
    schedule: true,
    review: true,
  },
  capabilities: {
    read: 'posts:read_drafts',
    write: 'posts:write',
    publish: 'posts:publish',
    delete: 'posts:delete',
  },
}
const ctx = { event: {} as H3Event, type }
const WRITER = ['posts:read_drafts', 'posts:write']
const EDITOR = [...WRITER, 'posts:publish']

function setup() {
  let time = Date.parse('2026-03-01T00:00:00Z')
  let capabilities: string[] | null = EDITOR
  const store = createMemoryStore()
  const adapter = createMarkdownContentAdapter({
    store,
    dir: 'content',
    now: () => new Date(time),
    getAccess: async (): Promise<PlutoGithubAccess | null> =>
      capabilities ? { capabilities, auth: { token: 't' } } : null,
  })
  return {
    adapter,
    store,
    as: (next: string[] | null) => {
      capabilities = next
    },
    setTime: (iso: string) => {
      time = Date.parse(iso)
    },
  }
}

describe('pending review on the Git CMS', () => {
  it('lets a writer save a draft and send it to review, with a submit commit', async () => {
    const { adapter, store, as } = setup()
    as(WRITER)

    await adapter.create(ctx, { title: 'Idea', content: 'Text' })
    const item = await adapter.update(ctx, 'idea', { status: 'review' })
    await adapter.update(ctx, 'idea', { title: 'Better idea' })

    expect(item.status).toBe('review')
    const history = await store.history('content/posts/idea.md', {
      limit: 5,
    })
    expect(history.commits.map((commit) => commit.message)).toContain(
      'content(post): submit "idea" [skip ci]'
    )
    const revisions = await adapter.listRevisions!(ctx, 'idea', { limit: 10 })
    expect(revisions.data.map((revision) => revision.action)).toEqual([
      'update',
      'update',
      'create',
    ])
  })

  it('refuses a writer that publishes, schedules or changes a published post', async () => {
    const { adapter, as } = setup()
    await adapter.create(ctx, { title: 'Live', status: 'published' })
    as(WRITER)

    await expect(
      adapter.create(ctx, { title: 'Mine', status: 'published' })
    ).rejects.toMatchObject({ statusCode: 403 })
    await adapter.create(ctx, { title: 'Draft' })
    await expect(
      adapter.update(ctx, 'draft', {
        status: 'scheduled',
        publishAt: '2026-04-01T00:00:00Z',
      })
    ).rejects.toMatchObject({ statusCode: 403 })
    await expect(
      adapter.update(ctx, 'live', { title: 'Changed' })
    ).rejects.toMatchObject({ statusCode: 403 })
  })

  it('lets an editor publish a review post', async () => {
    const { adapter, as } = setup()
    as(WRITER)
    await adapter.create(ctx, { title: 'Idea', status: 'review' })
    as(EDITOR)

    expect(
      (await adapter.update(ctx, 'idea', { status: 'published' })).status
    ).toBe('published')
  })
})

describe('scheduled publish on the Git CMS', () => {
  it('shows a scheduled post to the public at its time, before the task publishes it', async () => {
    const { adapter, as, setTime } = setup()
    await adapter.create(ctx, {
      title: 'Later',
      status: 'scheduled',
      publishAt: '2026-03-02T09:00:00Z',
    })
    as(null)

    expect(await adapter.get(ctx, 'later')).toBeNull()
    setTime('2026-03-02T09:00:00Z')
    expect(await adapter.get(ctx, 'later')).toMatchObject({
      status: 'scheduled',
      publishedAt: '2026-03-02T09:00:00.000Z',
    })
    expect((await adapter.list(ctx, {})).total).toBe(1)
  })

  it('commits a schedule with a skip, and the publish of the task without one', async () => {
    const { adapter, store } = setup()
    await adapter.create(ctx, { title: 'Later' })
    await adapter.update(ctx, 'later', {
      status: 'scheduled',
      publishAt: '2026-03-02T09:00:00Z',
    })
    await adapter.publishDue!(ctx, '2026-03-02T09:05:00Z')

    const messages = (
      await store.history('content/posts/later.md', { limit: 5 })
    ).commits.map((commit) => commit.message)
    expect(messages.slice(0, 2)).toEqual([
      'content(post): publish 1 scheduled',
      'content(post): schedule "later" [skip ci]',
    ])
  })

  it('needs the publish capability for publishDue', async () => {
    const { adapter, as } = setup()
    as(WRITER)
    await expect(
      adapter.publishDue!(ctx, '2026-03-02T00:00:00Z')
    ).rejects.toMatchObject({ statusCode: 403 })
  })
})

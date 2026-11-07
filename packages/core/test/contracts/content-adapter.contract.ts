import type { H3Event } from 'h3'
import type {
  PlutoContentAdapter,
  PlutoContentContext,
  PlutoContentItem,
  PlutoContentType,
} from '../../shared/types/content'
import { beforeEach, describe, expect, it } from 'vitest'

/** The caller a test acts as. `null` is anonymous. */
export type ContractCaller = {
  capabilities: string[]
} | null

export interface ContractHarness {
  adapter: PlutoContentAdapter
  /** Sets the caller of the next adapter calls. */
  as: (caller: ContractCaller) => void
}

export interface ContractOptions {
  /** The content type to test. It needs a status, a slug field and a richtext field. */
  type: PlutoContentType
}

/** A clock that moves one minute on each call, from a fixed start. */
export function createContractClock(): () => Date {
  let time = Date.parse('2026-03-01T00:00:00Z')
  return () => new Date((time += 60_000))
}

const EDITOR: ContractCaller = {
  capabilities: ['posts:read_drafts', 'posts:publish', 'posts:delete'],
}
const VIEWER: ContractCaller = { capabilities: [] }

/**
 * The tests every `PlutoContentAdapter` over the post content type must
 * pass. `makeAdapter` gets a clock and must give the adapter a fresh, empty
 * store and that clock. The clock sets the created and updated times.
 */
export function runContentAdapterContract(
  name: string,
  makeAdapter: (clock: () => Date) => Promise<ContractHarness>,
  options: ContractOptions
): void {
  const { type } = options
  const event = {} as H3Event
  const ctx: PlutoContentContext = { event, type }

  describe(`content adapter contract: ${name}`, () => {
    let harness: ContractHarness
    let adapter: PlutoContentAdapter

    beforeEach(async () => {
      harness = await makeAdapter(createContractClock())
      adapter = harness.adapter
      harness.as(EDITOR)
    })

    async function add(
      title: string,
      extra: Record<string, unknown> = {}
    ): Promise<PlutoContentItem> {
      return adapter.create(ctx, {
        title,
        content: `Body of ${title}`,
        ...extra,
      })
    }

    describe('create and get', () => {
      it('creates a draft with the slug as id and a version token', async () => {
        const item = await add('Hello World')

        expect(item).toMatchObject({
          id: 'hello-world',
          slug: 'hello-world',
          title: 'Hello World',
          status: 'draft',
          content: 'Body of Hello World',
        })
        expect(typeof item._version).toBe('string')
        expect(await adapter.get(ctx, 'hello-world')).toMatchObject({
          id: 'hello-world',
          title: 'Hello World',
          content: 'Body of Hello World',
          _version: item._version,
        })
      })

      it('uses an explicit slug', async () => {
        expect((await add('Hello', { slug: 'custom-slug' })).id).toBe(
          'custom-slug'
        )
      })

      it('rejects an invalid slug with 400', async () => {
        await expect(add('Hello', { slug: '../evil' })).rejects.toMatchObject({
          statusCode: 400,
        })
        await expect(add('???')).rejects.toMatchObject({ statusCode: 400 })
      })

      it('rejects a taken slug with 409', async () => {
        await add('Hello')

        await expect(add('Hello')).rejects.toMatchObject({ statusCode: 409 })
      })

      it('returns null for a missing item', async () => {
        expect(await adapter.get(ctx, 'nope')).toBeNull()
        expect(await adapter.get(ctx, '../nope')).toBeNull()
      })
    })

    describe('list', () => {
      beforeEach(async () => {
        await add('Alpha', { status: 'published', excerpt: 'First' })
        await add('Bravo')
        await add('Charlie', { status: 'published' })
        await add('Delta')
        await add('Echo', { status: 'published' })
      })

      it('sorts by createdAt descending by default, with the total', async () => {
        const result = await adapter.list(ctx, { includeUnpublished: true })

        expect(result.total).toBe(5)
        expect(result.data.map((item) => item.id)).toEqual([
          'echo',
          'delta',
          'charlie',
          'bravo',
          'alpha',
        ])
      })

      it('omits the body and keeps the excerpt', async () => {
        const result = await adapter.list(ctx, { includeUnpublished: true })
        const alpha = result.data.find((item) => item.id === 'alpha')!

        expect(alpha.content).toBeUndefined()
        expect(alpha.excerpt).toBe('First')
        expect(typeof alpha._version).toBe('string')
      })

      it('filters to published unless drafts are asked for', async () => {
        const published = await adapter.list(ctx, {})
        const all = await adapter.list(ctx, { includeUnpublished: true })

        expect(published.data.map((item) => item.id)).toEqual([
          'echo',
          'charlie',
          'alpha',
        ])
        expect(published.total).toBe(3)
        expect(all.total).toBe(5)
      })

      it('searches the title without case', async () => {
        const result = await adapter.list(ctx, {
          includeUnpublished: true,
          search: 'ARL',
        })

        expect(result.data.map((item) => item.id)).toEqual(['charlie'])
        expect(result.total).toBe(1)
      })

      it('sorts by a field', async () => {
        const result = await adapter.list(ctx, {
          includeUnpublished: true,
          sort: { field: 'title', direction: 'asc' },
        })

        expect(result.data.map((item) => item.id)).toEqual([
          'alpha',
          'bravo',
          'charlie',
          'delta',
          'echo',
        ])
      })

      it('keeps one status', async () => {
        const drafts = await adapter.list(ctx, {
          includeUnpublished: true,
          status: 'draft',
        })
        const published = await adapter.list(ctx, {
          includeUnpublished: true,
          status: 'published',
        })

        expect(drafts.data.map((item) => item.id)).toEqual(['delta', 'bravo'])
        expect(drafts.total).toBe(2)
        expect(published.data.map((item) => item.id)).toEqual([
          'echo',
          'charlie',
          'alpha',
        ])
      })

      it('pages with offset and limit, and the total stays the filtered count', async () => {
        const page = await adapter.list(ctx, {
          includeUnpublished: true,
          sort: { field: 'title', direction: 'asc' },
          offset: 1,
          limit: 2,
        })

        expect(page.data.map((item) => item.id)).toEqual(['bravo', 'charlie'])
        expect(page.total).toBe(5)
        expect(
          (await adapter.list(ctx, { includeUnpublished: true, limit: 1 })).data
        ).toHaveLength(1)
      })
    })

    describe('anonymous access', () => {
      beforeEach(async () => {
        await add('Public', { status: 'published' })
        await add('Secret')
        harness.as(null)
      })

      it('never lists drafts, even when asked', async () => {
        const result = await adapter.list(ctx, { includeUnpublished: true })

        expect(result.data.map((item) => item.id)).toEqual(['public'])
        expect(result.total).toBe(1)
        expect(
          (
            await adapter.list(ctx, {
              includeUnpublished: true,
              status: 'draft',
            })
          ).data
        ).toEqual([])
      })

      it('gets a published item and not a draft', async () => {
        expect(await adapter.get(ctx, 'public')).toMatchObject({
          title: 'Public',
        })
        expect(await adapter.get(ctx, 'secret')).toBeNull()
      })

      it('counts only published items', async () => {
        const range = {
          from: '2026-03-01T00:00:00Z',
          to: '2026-03-02T00:00:00Z',
        }

        expect(await adapter.countCreated!(ctx, range)).toBe(1)
        harness.as(EDITOR)
        expect(await adapter.countCreated!(ctx, range)).toBe(2)
      })
    })

    describe('signed in without the read capability', () => {
      it('sees published items only', async () => {
        await add('Public', { status: 'published' })
        await add('Secret')
        harness.as(VIEWER)

        expect(
          (await adapter.list(ctx, { includeUnpublished: true })).data.map(
            (item) => item.id
          )
        ).toEqual(['public'])
        expect(await adapter.get(ctx, 'secret')).toBeNull()
      })
    })

    describe('writes need access', () => {
      beforeEach(async () => {
        await add('Existing')
      })

      it('answers 401 with no access', async () => {
        harness.as(null)

        await expect(add('New')).rejects.toMatchObject({ statusCode: 401 })
        await expect(
          adapter.update(ctx, 'existing', { title: 'X' })
        ).rejects.toMatchObject({ statusCode: 401 })
        await expect(adapter.remove(ctx, 'existing')).rejects.toMatchObject({
          statusCode: 401,
        })
        await expect(
          adapter.authorize!(event, 'posts:publish')
        ).rejects.toMatchObject({ statusCode: 401 })
      })

      it('answers 403 without the capability', async () => {
        harness.as(VIEWER)

        await expect(add('New')).rejects.toMatchObject({ statusCode: 403 })
        await expect(
          adapter.update(ctx, 'existing', { title: 'X' })
        ).rejects.toMatchObject({ statusCode: 403 })
        await expect(adapter.remove(ctx, 'existing')).rejects.toMatchObject({
          statusCode: 403,
        })
        await expect(
          adapter.authorize!(event, 'posts:publish')
        ).rejects.toMatchObject({ statusCode: 403 })
      })

      it('lets a holder of the capability pass authorize', async () => {
        await expect(
          adapter.authorize!(event, 'posts:publish')
        ).resolves.toBeUndefined()
      })
    })

    describe('update', () => {
      it('changes fields and keeps the id', async () => {
        const created = await add('Hello')
        const saved = await adapter.update(ctx, 'hello', {
          title: 'Hello again',
          content: 'New body',
          _version: created._version,
        })

        expect(saved).toMatchObject({
          id: 'hello',
          title: 'Hello again',
          content: 'New body',
        })
        expect(saved._version).not.toBe(created._version)
        expect(await adapter.get(ctx, 'hello')).toMatchObject({
          title: 'Hello again',
          _version: saved._version,
        })
      })

      it('keeps the other fields on a partial update', async () => {
        await add('Hello', { excerpt: 'Short' })
        const saved = await adapter.update(ctx, 'hello', { title: 'Hi' })

        expect(saved).toMatchObject({
          title: 'Hi',
          excerpt: 'Short',
          content: 'Body of Hello',
        })
      })

      it('answers 409 for a stale version', async () => {
        const created = await add('Hello')
        await adapter.update(ctx, 'hello', {
          title: 'First edit',
          _version: created._version,
        })

        await expect(
          adapter.update(ctx, 'hello', {
            title: 'Second edit',
            _version: created._version,
          })
        ).rejects.toMatchObject({ statusCode: 409 })
        expect(await adapter.get(ctx, 'hello')).toMatchObject({
          title: 'First edit',
        })
      })

      it('answers 404 for a missing item', async () => {
        await expect(
          adapter.update(ctx, 'nope', { title: 'X' })
        ).rejects.toMatchObject({ statusCode: 404 })
      })

      it('publishes and unpublishes', async () => {
        await add('Hello')
        expect(
          await adapter.update(ctx, 'hello', { status: 'published' })
        ).toMatchObject({ status: 'published' })

        harness.as(null)
        expect(await adapter.get(ctx, 'hello')).not.toBeNull()
        harness.as(EDITOR)

        await adapter.update(ctx, 'hello', { status: 'draft' })
        harness.as(null)
        expect(await adapter.get(ctx, 'hello')).toBeNull()
      })

      it('rejects an unknown status with 400', async () => {
        await add('Hello')

        await expect(
          adapter.update(ctx, 'hello', { status: 'weird' })
        ).rejects.toMatchObject({ statusCode: 400 })
      })
    })

    describe('rename', () => {
      it('moves the item to the new slug, keeps the content and returns the new id', async () => {
        const created = await add('Hello', {
          excerpt: 'Short',
          status: 'published',
        })
        const saved = await adapter.update(ctx, 'hello', {
          slug: 'renamed',
          _version: created._version,
        })

        expect(saved).toMatchObject({
          id: 'renamed',
          slug: 'renamed',
          title: 'Hello',
          excerpt: 'Short',
          content: 'Body of Hello',
          status: 'published',
        })
        expect(await adapter.get(ctx, 'hello')).toBeNull()
        expect(await adapter.get(ctx, 'renamed')).toMatchObject({
          title: 'Hello',
          content: 'Body of Hello',
        })
        expect(
          (await adapter.list(ctx, { includeUnpublished: true })).total
        ).toBe(1)
      })

      it('answers 409 when the new slug is taken, and changes nothing', async () => {
        await add('Hello')
        await add('Other')

        await expect(
          adapter.update(ctx, 'hello', { slug: 'other' })
        ).rejects.toMatchObject({ statusCode: 409 })
        expect(await adapter.get(ctx, 'hello')).toMatchObject({
          title: 'Hello',
        })
        expect(await adapter.get(ctx, 'other')).toMatchObject({
          title: 'Other',
        })
      })

      it('rejects an invalid new slug with 400', async () => {
        await add('Hello')

        await expect(
          adapter.update(ctx, 'hello', { slug: 'Bad Slug' })
        ).rejects.toMatchObject({ statusCode: 400 })
      })
    })

    describe('remove', () => {
      it('deletes the item', async () => {
        await add('Hello')
        await adapter.remove(ctx, 'hello')

        expect(await adapter.get(ctx, 'hello')).toBeNull()
        expect(
          (await adapter.list(ctx, { includeUnpublished: true })).total
        ).toBe(0)
      })

      it('answers 404 for a missing item', async () => {
        await expect(adapter.remove(ctx, 'nope')).rejects.toMatchObject({
          statusCode: 404,
        })
      })
    })

    describe('trash', () => {
      function trashOf() {
        if (!adapter.trash) {
          throw new Error('no trash')
        }
        return adapter.trash
      }

      it('moves an item to the trash, lists it, and restores it with its id and content', async () => {
        if (!adapter.trash) {
          return
        }
        await add('Hello', { status: 'published', excerpt: 'Kept' })
        await add('Other')
        await trashOf().move(ctx, 'hello')

        expect(await adapter.get(ctx, 'hello')).toBeNull()
        const live = await adapter.list(ctx, { includeUnpublished: true })
        expect(live.data.map((item) => item.id)).toEqual(['other'])

        const trashed = await trashOf().list(ctx, {})
        expect(trashed.total).toBe(1)
        expect(trashed.data[0]).toMatchObject({ id: 'hello', title: 'Hello' })
        expect(typeof trashed.data[0]!._deletedAt).toBe('string')

        const restored = await trashOf().restore(ctx, 'hello')
        expect(restored).toMatchObject({
          id: 'hello',
          title: 'Hello',
          excerpt: 'Kept',
          status: 'published',
          content: 'Body of Hello',
        })
        expect((await trashOf().list(ctx, {})).total).toBe(0)
        expect(await adapter.get(ctx, 'hello')).toMatchObject({ id: 'hello' })
      })

      it('searches the trash by title, the last trashed first', async () => {
        if (!adapter.trash) {
          return
        }
        await add('Alpha')
        await add('Bravo')
        await add('Charlie')
        await trashOf().move(ctx, 'alpha')
        await trashOf().move(ctx, 'charlie')

        expect(
          (await trashOf().list(ctx, {})).data.map((item) => item.id)
        ).toEqual(['charlie', 'alpha'])
        expect(
          (await trashOf().list(ctx, { search: 'ALP' })).data.map(
            (item) => item.id
          )
        ).toEqual(['alpha'])
      })

      it('answers 409 when a live item has the id, and 404 for an item not in the trash', async () => {
        if (!adapter.trash) {
          return
        }
        await add('Hello')
        await trashOf().move(ctx, 'hello')
        await add('Hello')

        await expect(trashOf().restore(ctx, 'hello')).rejects.toMatchObject({
          statusCode: 409,
        })
        await expect(trashOf().restore(ctx, 'nope')).rejects.toMatchObject({
          statusCode: 404,
        })
        await expect(trashOf().move(ctx, 'nope')).rejects.toMatchObject({
          statusCode: 404,
        })
      })

      it('purges one item, and every item trashed before a time', async () => {
        if (!adapter.trash) {
          return
        }
        await add('One')
        await add('Two')
        await add('Three')
        await trashOf().move(ctx, 'one')
        await trashOf().move(ctx, 'two')
        await trashOf().move(ctx, 'three')

        await trashOf().purge(ctx, 'one')
        await expect(trashOf().purge(ctx, 'one')).rejects.toMatchObject({
          statusCode: 404,
        })
        expect(await trashOf().purgeBefore(ctx, '2000-01-01T00:00:00Z')).toBe(0)
        expect(await trashOf().purgeBefore(ctx, '2999-01-01T00:00:00Z')).toBe(2)
        expect((await trashOf().list(ctx, {})).total).toBe(0)
        expect(await adapter.get(ctx, 'two')).toBeNull()
      })

      it('needs the delete capability', async () => {
        if (!adapter.trash) {
          return
        }
        await add('Hello')
        harness.as(VIEWER)

        await expect(trashOf().move(ctx, 'hello')).rejects.toMatchObject({
          statusCode: 403,
        })
        await expect(trashOf().list(ctx, {})).rejects.toMatchObject({
          statusCode: 403,
        })
      })
    })

    describe('countCreated', () => {
      it('counts by creation time in a half-open range', async () => {
        // The clock gives 00:01, 00:02, 00:03 and 00:04 to the four creates.
        for (const title of ['One', 'Two', 'Three', 'Four']) {
          await add(title)
        }

        expect(
          await adapter.countCreated!(ctx, {
            from: '2026-03-01T00:00:00Z',
            to: '2026-03-01T00:05:00Z',
          })
        ).toBe(4)
        expect(
          await adapter.countCreated!(ctx, {
            from: '2026-03-01T00:02:00Z',
            to: '2026-03-01T00:04:00Z',
          })
        ).toBe(2)
        expect(
          await adapter.countCreated!(ctx, {
            from: '2026-03-01T00:05:00Z',
            to: '2026-03-02T00:00:00Z',
          })
        ).toBe(0)
      })
    })
  })
}

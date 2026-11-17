import type { PlutoFormStore } from '../shared/types/forms'
import { beforeEach, describe, expect, it } from 'vitest'

/**
 * The behavior that every `PlutoFormStore` must have. A backend layer (the Supabase store) runs it
 * with a function that makes an empty store.
 */
export function describeFormStoreContract(
  name: string,
  create: () => Promise<PlutoFormStore> | PlutoFormStore
) {
  describe(`${name} as a PlutoFormStore`, () => {
    let store: PlutoFormStore

    beforeEach(async () => {
      store = await create()
    })

    it('adds a submission and reads it back', async () => {
      const added = await store.add({
        form: 'contact',
        values: { name: 'Ana', age: 30, ok: true },
      })

      expect(added.id).toBeTruthy()
      expect(added.form).toBe('contact')
      expect(Number.isNaN(Date.parse(added.createdAt))).toBe(false)
      expect(await store.get('contact', added.id)).toEqual(added)
      expect(added.values).toEqual({ name: 'Ana', age: 30, ok: true })
    })

    it('keeps the forms apart', async () => {
      const a = await store.add({ form: 'a', values: { x: '1' } })
      await store.add({ form: 'b', values: { x: '2' } })

      expect((await store.list('a', { limit: 10, offset: 0 })).total).toBe(1)
      expect(await store.get('b', a.id)).toBeNull()
    })

    it('lists the newest first, with paging and a total', async () => {
      const base = Date.parse('2026-01-01T00:00:00Z')
      for (let index = 0; index < 5; index++) {
        await store.add({
          form: 'contact',
          values: { n: String(index) },
          createdAt: new Date(base + index * 60_000).toISOString(),
        })
      }

      const first = await store.list('contact', { limit: 2, offset: 0 })
      const second = await store.list('contact', { limit: 2, offset: 2 })
      const last = await store.list('contact', { limit: 2, offset: 4 })

      expect(first.total).toBe(5)
      expect(first.data.map((item) => item.values.n)).toEqual(['4', '3'])
      expect(second.data.map((item) => item.values.n)).toEqual(['2', '1'])
      expect(last.data.map((item) => item.values.n)).toEqual(['0'])
    })

    it('returns an empty page for a form with no submissions', async () => {
      expect(await store.list('empty', { limit: 10, offset: 0 })).toEqual({
        data: [],
        total: 0,
      })
    })

    it('answers null for a missing submission', async () => {
      expect(await store.get('contact', '0000000000000-00000000')).toBeNull()
      expect(await store.get('contact', 'not-an-id')).toBeNull()
    })

    it('deletes one submission, and a missing one is not an error', async () => {
      const keep = await store.add({ form: 'contact', values: { n: 'keep' } })
      const drop = await store.add({ form: 'contact', values: { n: 'drop' } })

      await store.delete('contact', drop.id)
      await store.delete('contact', drop.id)

      expect(await store.get('contact', drop.id)).toBeNull()
      expect((await store.list('contact', { limit: 10, offset: 0 })).data).toEqual([keep])
    })

    it('purges the submissions older than a date, and counts them', async () => {
      const day = 24 * 60 * 60 * 1000
      const now = Date.parse('2026-06-01T00:00:00Z')
      for (const age of [10, 5, 1]) {
        await store.add({
          form: 'contact',
          values: { age: String(age) },
          createdAt: new Date(now - age * day).toISOString(),
        })
      }
      await store.add({
        form: 'other',
        values: { age: '10' },
        createdAt: new Date(now - 10 * day).toISOString(),
      })

      const purged = await store.purge('contact', new Date(now - 3 * day))

      expect(purged).toBe(2)
      expect(
        (await store.list('contact', { limit: 10, offset: 0 })).data.map(
          (item) => item.values.age
        )
      ).toEqual(['1'])
      expect((await store.list('other', { limit: 10, offset: 0 })).total).toBe(1)
      expect(await store.purge('contact', new Date(now - 3 * day))).toBe(0)
    })
  })
}

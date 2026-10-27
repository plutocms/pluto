import type { PlutoContentType } from '../shared/types/content'
import { afterEach, describe, expect, it, vi } from 'vitest'

// The content registry is a module-scope singleton, so each test loads fresh
// copies of the registry and of `mapRepoPermission`.
afterEach(() => {
  vi.resetModules()
})

function docType(): PlutoContentType {
  return {
    name: 'doc',
    label: 'Doc',
    labelPlural: 'Docs',
    source: 'docs',
    titleField: 'title',
    fields: [{ name: 'title', type: 'text', label: 'Title' }],
    capabilities: { read: 'docs:read', write: 'docs:write', delete: 'docs:delete' },
  }
}

async function load() {
  const registry = await import('../server/utils/pluto-content')
  const oauth = await import('../modules/pluto-github/runtime/server/utils/github-oauth')
  return { ...registry, ...oauth }
}

describe('listContentTypes', () => {
  it('lists the registered types in registration order', async () => {
    const { registerContentType, listContentTypes } = await load()
    expect(listContentTypes()).toEqual([])

    registerContentType(docType())
    registerContentType({ ...docType(), name: 'page' })

    expect(listContentTypes().map((type) => type.name)).toEqual(['doc', 'page'])
  })
})

describe('mapRepoPermission for push', () => {
  it('falls back to the post type when no type is registered', async () => {
    const { mapRepoPermission } = await load()

    expect(mapRepoPermission({ push: true })!.capabilities).toEqual(['posts:read_drafts', 'posts:publish', 'posts:delete'])
  })

  it('gives the capabilities of every registered type', async () => {
    const { registerContentType, mapRepoPermission } = await load()
    registerContentType(docType())
    registerContentType({ ...docType(), name: 'other', capabilities: { read: 'docs:read', write: 'other:write', publish: 'other:publish' } })

    expect(mapRepoPermission({ push: true })!.capabilities).toEqual([
      'docs:read',
      'docs:write',
      'docs:delete',
      'other:write',
      'other:publish',
    ])
  })

  it('does not widen admin or a lower permission', async () => {
    const { registerContentType, mapRepoPermission } = await load()
    registerContentType(docType())

    expect(mapRepoPermission({ admin: true })).toEqual({ permission: 'admin', capabilities: ['*'] })
    expect(mapRepoPermission({ pull: true })).toBeNull()
  })
})

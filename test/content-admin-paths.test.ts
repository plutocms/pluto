import type { PlutoContentType } from '../shared/types/content'
import { describe, expect, it } from 'vitest'
import { contentTypeAdminBar, contentTypeBasePath, contentTypeEditPath, contentTypeNewPath } from '../shared/utils/content-admin-paths'

const base: PlutoContentType = { name: 'post', label: 'Post', labelPlural: 'Posts', source: 'posts', titleField: 'title', fields: [] }

describe('content admin paths', () => {
  it('uses /admin/content/<name> by default', () => {
    expect(contentTypeBasePath(base)).toBe('/admin/content/post')
    expect(contentTypeNewPath(base)).toBe('/admin/content/post/new')
    expect(contentTypeEditPath(base, 'hello')).toBe('/admin/content/post/hello')
  })

  it('encodes each segment of a nested id and keeps the slashes', () => {
    expect(contentTypeEditPath(base, '2.core/a b')).toBe('/admin/content/post/2.core/a%20b')
  })

  it('follows basePath, newPath and editPath', () => {
    const type = { ...base, basePath: '/admin/posts', newPath: '/admin/post/new', editPath: (id: string | number) => `/admin/post/edit/${id}` }
    expect(contentTypeBasePath(type)).toBe('/admin/posts')
    expect(contentTypeNewPath(type)).toBe('/admin/post/new')
    expect(contentTypeEditPath(type, 7)).toBe('/admin/post/edit/7')
    expect(contentTypeNewPath({ ...base, basePath: '/admin/posts' })).toBe('/admin/posts/new')
  })
})

describe('contentTypeAdminBar', () => {
  it('gives no buttons when unset or false', () => {
    expect(contentTypeAdminBar(base)).toEqual({ new: false, edit: false })
    expect(contentTypeAdminBar({ ...base, adminBar: false })).toEqual({ new: false, edit: false })
  })

  it('gives both buttons for true', () => {
    expect(contentTypeAdminBar({ ...base, adminBar: true })).toEqual({ new: true, edit: true })
  })

  it('gives only the buttons that an object asks for', () => {
    expect(contentTypeAdminBar({ ...base, adminBar: { new: true } })).toEqual({ new: true, edit: false })
    expect(contentTypeAdminBar({ ...base, adminBar: { edit: true } })).toEqual({ new: false, edit: true })
  })
})

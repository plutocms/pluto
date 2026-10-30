import { Buffer } from 'node:buffer'
import { describe, expect, it } from 'vitest'
import {
  gitBlobSha,
  listingOid,
} from '../modules/pluto-github/runtime/server/utils/blob-sha'

describe('gitBlobSha', () => {
  it('matches git hash-object', () => {
    expect(gitBlobSha('hello\n')).toBe(
      'ce013625030ba8dba906f756967f9e9ca394464a'
    )
    expect(gitBlobSha('')).toBe('e69de29bb2d1d6434b8b29ae775ad8c2e48c5391')
  })

  it('uses the UTF-8 byte length', () => {
    // `printf '\xc3\xa9\n' | git hash-object --stdin`: a 3 byte blob.
    expect(gitBlobSha('é\n')).toBe(
      gitBlobSha(Buffer.from([0xc3, 0xa9, 0x0a]).toString('utf8'))
    )
    expect(gitBlobSha('é')).not.toBe(gitBlobSha('e'))
  })
})

describe('listingOid', () => {
  it('ignores the order and changes with the content', () => {
    const a = { path: 'a.md', oid: '1' }
    const b = { path: 'b.md', oid: '2' }

    expect(listingOid([a, b])).toBe(listingOid([b, a]))
    expect(listingOid([a, b])).not.toBe(listingOid([a, { ...b, oid: '3' }]))
    expect(listingOid([a])).not.toBe(listingOid([{ ...a, path: 'c.md' }]))
  })
})

import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'

export function gitBlobSha(text: string): string {
  const bytes = Buffer.from(text, 'utf8')
  return createHash('sha1')
    .update(`blob ${bytes.length}\0`)
    .update(bytes)
    .digest('hex')
}

export function listingOid(
  entries: {
    path: string
    oid: string
  }[]
): string {
  const hash = createHash('sha1')
  const sorted = [...entries].sort((a, b) =>
    a.path < b.path ? -1 : a.path > b.path ? 1 : 0
  )
  for (const entry of sorted) {
    hash.update(`${entry.path}\0${entry.oid}\n`)
  }
  return hash.digest('hex')
}

import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'

/** The Git blob id of a text: sha1 of `blob <byteLength>\0` and the UTF-8 bytes. */
export function gitBlobSha(text: string): string {
  const bytes = Buffer.from(text, 'utf8')
  return createHash('sha1')
    .update(`blob ${bytes.length}\0`)
    .update(bytes)
    .digest('hex')
}

/** A head id for a flat listing. It changes when a path or a content changes. */
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

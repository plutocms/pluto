import type { H3Event } from 'h3'
import { describe, expect, it } from 'vitest'
import { isPublicRead, markPublicRead } from '../server/utils/pluto-public-read'

describe('markPublicRead', () => {
  it('marks the request, and only that request', () => {
    const marked = { context: {} } as H3Event
    const other = { context: {} } as H3Event

    expect(isPublicRead(marked)).toBe(false)
    markPublicRead(marked)

    expect(isPublicRead(marked)).toBe(true)
    expect(isPublicRead(other)).toBe(false)
  })

  it('is idempotent', () => {
    const event = { context: {} } as H3Event
    markPublicRead(event)
    markPublicRead(event)

    expect(isPublicRead(event)).toBe(true)
  })
})

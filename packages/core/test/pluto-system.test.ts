import { describe, expect, it } from 'vitest'
import {
  createPlutoSystemEvent,
  isPlutoSystemEvent,
} from '../server/utils/pluto-system'

describe('the system request', () => {
  it('marks only an event of createPlutoSystemEvent', () => {
    expect(isPlutoSystemEvent(createPlutoSystemEvent())).toBe(true)
    expect(isPlutoSystemEvent({ context: {} } as never)).toBe(false)
    // A header or a query cannot make one: only the server context counts.
    expect(
      isPlutoSystemEvent({
        context: { plutoSystem: 'true' },
        headers: new Headers({ 'x-pluto-system': 'true' }),
      } as never)
    ).toBe(false)
    expect(isPlutoSystemEvent(undefined)).toBe(false)
  })
})

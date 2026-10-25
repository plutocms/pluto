import { describe, expect, it } from 'vitest'
import { isPostTypeOn, showPublicRepoWarning } from '../modules/pluto-cms/runtime/shared/client-rules'
import { plutoCmsPostType } from '../modules/pluto-cms/runtime/shared/post-type'

describe('isPostTypeOn', () => {
  it('is on unless the option is false', () => {
    expect(isPostTypeOn({ postType: true })).toBe(true)
    expect(isPostTypeOn({})).toBe(true)
    expect(isPostTypeOn(undefined)).toBe(true)
    expect(isPostTypeOn({ postType: false })).toBe(false)
  })
})

describe('showPublicRepoWarning', () => {
  const noStatus = { status: false as const }

  it('shows for a public repo and a type with a status', () => {
    expect(showPublicRepoWarning(false, [plutoCmsPostType])).toBe(true)
    expect(showPublicRepoWarning(false, [noStatus, plutoCmsPostType])).toBe(true)
  })

  it('hides when no registered type has a status', () => {
    expect(showPublicRepoWarning(false, [])).toBe(false)
    expect(showPublicRepoWarning(false, [noStatus, {}])).toBe(false)
  })

  it('hides for a private or unknown repo', () => {
    expect(showPublicRepoWarning(true, [plutoCmsPostType])).toBe(false)
    expect(showPublicRepoWarning(undefined, [plutoCmsPostType])).toBe(false)
  })
})

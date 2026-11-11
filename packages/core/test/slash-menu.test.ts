import { getSchema } from '@tiptap/core'
import { EditorState } from '@tiptap/pm/state'
import StarterKit from '@tiptap/starter-kit'
import { describe, expect, it } from 'vitest'
import { plutoSlashMenuAllowed } from '../app/utils/pluto-slash-menu'

const schema = getSchema([StarterKit])

type Text = { text: string; code?: boolean }

/** The state of a doc with one block, and the range of the "/" in it. */
function slashIn(block: 'paragraph' | 'codeBlock', parts: Text[]) {
  const content = parts.map((part) => ({
    type: 'text',
    text: part.text,
    ...(part.code && { marks: [{ type: 'code' }] }),
  }))
  const doc = schema.nodeFromJSON({ type: 'doc', content: [{ type: block, content }] })
  const text = parts.map((part) => part.text).join('')
  const from = 1 + text.lastIndexOf('/')
  return { state: EditorState.create({ schema, doc }), range: { from, to: from + 1 } }
}

describe('plutoSlashMenuAllowed', () => {
  it('opens the menu for a "/" in plain text', () => {
    expect(plutoSlashMenuAllowed(slashIn('paragraph', [{ text: '/' }]))).toBe(true)
    expect(plutoSlashMenuAllowed(slashIn('paragraph', [{ text: 'hello /' }]))).toBe(true)
    expect(plutoSlashMenuAllowed(slashIn('paragraph', [{ text: 'a `b` /' }]))).toBe(true)
  })

  it('keeps it closed after an open backtick', () => {
    expect(plutoSlashMenuAllowed(slashIn('paragraph', [{ text: '`a /' }]))).toBe(false)
    expect(plutoSlashMenuAllowed(slashIn('paragraph', [{ text: 'a `b` `c /' }]))).toBe(false)
  })

  it('keeps it closed in inline code and in a code block', () => {
    expect(
      plutoSlashMenuAllowed(slashIn('paragraph', [{ text: 'see ' }, { text: 'src /a', code: true }]))
    ).toBe(false)
    expect(plutoSlashMenuAllowed(slashIn('codeBlock', [{ text: 'cd /' }]))).toBe(false)
  })
})

import { describe, expect, it } from 'vitest'
import { parsePlutoBlocks } from '../server/utils/pluto-blocks'
import { stripRawTextElements } from '../shared/utils/blocks/strip-raw-text'

describe('stripRawTextElements', () => {
  it('removes a style and a script with their content', () => {
    expect(
      stripRawTextElements(
        'a<style>#x{color:red}</style>b<script>alert(1)</script>c'
      )
    ).toBe('abc')
  })

  it('matches uppercase tags and attributes', () => {
    expect(
      stripRawTextElements(
        '<STYLE type="text/css">x</STYLE><Script src="a">y</SCRIPT>ok'
      )
    ).toBe('ok')
  })

  it('removes the other raw-text elements', () => {
    expect(
      stripRawTextElements(
        '<noscript>a</noscript><iframe src="x">b</iframe><object>c</object><embed>d</embed><textarea>e</textarea>z'
      )
    ).toBe('z')
  })

  it('removes nested elements', () => {
    expect(
      stripRawTextElements(
        '<noscript><style>x</style><script>y</script></noscript>k'
      )
    ).toBe('k')
  })

  it('does not touch a template', () => {
    expect(stripRawTextElements('<template><p>t</p></template>')).toBe(
      '<template><p>t</p></template>'
    )
  })
})

describe('parsePlutoBlocks with blocked raw text in a slot', () => {
  it('drops the text of a style and a script at the top level', async () => {
    const document = await parsePlutoBlocks(
      '<style>\n#x{color:red}\n</style>\n\n<script>alert(1)</script>\n'
    )

    expect(JSON.stringify(document.nodes)).not.toContain('alert')
    expect(JSON.stringify(document.nodes)).not.toContain('#x')
  })

  it('drops the text inside a slot', async () => {
    const document = await parsePlutoBlocks(
      '::block-section\n<style>\n#x { color: red; }\n</style>\n\n<script>alert(1)</script>\n\nKept\n::\n'
    )
    const text = JSON.stringify(document.nodes)

    expect(text).not.toContain('alert')
    expect(text).not.toContain('#x')
    expect(text).toContain('Kept')
  })

  it('drops the text inside two levels of slots, in uppercase', async () => {
    const document = await parsePlutoBlocks(
      ':::block-section\n::block-text\n<SCRIPT>alert(2)</SCRIPT>\nHi\n::\n:::\n'
    )

    expect(JSON.stringify(document.nodes)).not.toContain('alert')
    expect(JSON.stringify(document.nodes)).toContain('Hi')
  })

  it('keeps the content of a template', async () => {
    const document = await parsePlutoBlocks(
      '::block-section\n<template><p>kept</p></template>\n::\n'
    )

    expect(JSON.stringify(document.nodes)).toContain('template')
  })
})

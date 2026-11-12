import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  definePlutoHighlighter,
  highlightPlutoHtml,
  plutoHighlighterChain,
  resetPlutoHighlighters,
} from '../server/utils/pluto-highlight'
import {
  safeHighlightClass,
  safeHighlightStyle,
  sanitizeHighlightHtml,
} from '../shared/markdown/sanitize-highlight'

afterEach(() => {
  resetPlutoHighlighters()
  vi.restoreAllMocks()
})

const BLOCK = '<pre><code class="language-ts">const a = 1 &lt; 2</code></pre>'

describe('sanitizeHighlightHtml', () => {
  it('keeps pre, code and span, with plain classes', () => {
    expect(
      sanitizeHighlightHtml(
        '<span class="hljs-keyword">const</span> <span class="hljs-title function_">a</span>'
      )
    ).toBe(
      '<span class="hljs-keyword">const</span> <span class="hljs-title function_">a</span>'
    )
  })

  it('keeps the whole block of Shiki: its colors, its variables and its tabindex', () => {
    expect(
      sanitizeHighlightHtml(
        '<pre class="shiki github-dark" style="background-color:#24292e;color:#e1e4e8" tabindex="0"><code><span style="color:#F97583;--shiki-dark:#ff7b72">const</span></code></pre>'
      )
    ).toBe(
      '<pre class="shiki github-dark" style="background-color:#24292e;color:#e1e4e8" tabindex="0"><code><span style="color:#F97583;--shiki-dark:#ff7b72">const</span></code></pre>'
    )
  })

  it('drops scripts, handlers, links and comments, and unwraps other elements', () => {
    expect(
      sanitizeHighlightHtml(
        '<span onclick="x()" class="a">1</span><script>alert(1)</script><a href="javascript:x">2</a><!-- c --><div>3</div><img src=x onerror=y>'
      )
    ).toBe('<span class="a">1</span>3')
  })

  it('filters the classes and the styles', () => {
    expect(safeHighlightClass('hljs-string "x" a<b ok')).toBe('hljs-string ok')
    expect(
      safeHighlightStyle(
        'color: red; background: url(x); position: fixed; --shiki-dark: #fff; color: expression(alert(1)); font-style: italic'
      )
    ).toBe('color:red;--shiki-dark:#fff;font-style:italic')
    expect(safeHighlightStyle('color: "red"')).toBe('')
  })
})

describe('highlightPlutoHtml', () => {
  it('leaves the HTML as it is with no highlighter', async () => {
    expect(await highlightPlutoHtml(BLOCK)).toBe(BLOCK)
  })

  it('gives the highlighter the plain code and the language, and keeps the block', async () => {
    const highlight = vi.fn(
      ({ code }: { code: string }) =>
        `<span class="hljs-keyword">${code.slice(0, 5)}</span>${code.slice(5).replace('<', '&lt;')}`
    )
    definePlutoHighlighter({ id: 'test', highlight })
    expect(await highlightPlutoHtml(`<p>Hi</p>${BLOCK}`)).toBe(
      '<p>Hi</p><pre><code class="language-ts"><span class="hljs-keyword">const</span> a = 1 &lt; 2</code></pre>'
    )
    expect(highlight).toHaveBeenCalledWith({
      code: 'const a = 1 < 2',
      lang: 'ts',
    })
  })

  it('takes a whole block, and sanitizes it', async () => {
    definePlutoHighlighter({
      id: 'shiki',
      highlight: () =>
        '<pre class="shiki" tabindex="0"><code><span style="color:#fff">x</span></code></pre><script>x</script>',
    })
    expect(await highlightPlutoHtml(BLOCK)).toBe(
      '<pre class="shiki" tabindex="0"><code><span style="color:#fff">x</span></code></pre>'
    )
  })

  it('leaves a block with no language, or that no highlighter knows, plain', async () => {
    definePlutoHighlighter({ id: 'none', highlight: () => undefined })
    const plain = '<pre><code>plain</code></pre>'
    expect(await highlightPlutoHtml(plain + BLOCK)).toBe(plain + BLOCK)
  })

  it('tries the chosen one first, then the others by order', async () => {
    definePlutoHighlighter({ id: 'b', order: 10, highlight: () => 'B' })
    definePlutoHighlighter({
      id: 'a',
      order: 20,
      highlight: ({ lang }) => (lang === 'vue' ? 'A' : null),
    })
    expect(plutoHighlighterChain().map((item) => item.id)).toEqual(['b', 'a'])
    expect(plutoHighlighterChain('a').map((item) => item.id)).toEqual([
      'a',
      'b',
    ])
    expect(await highlightPlutoHtml(BLOCK, 'a')).toContain('>B</code>')
    expect(
      await highlightPlutoHtml(
        '<pre><code class="language-vue">x</code></pre>',
        'a'
      )
    ).toContain('>A</code>')
  })

  it('warns once for a missing choice and a failing highlighter, and goes on', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    definePlutoHighlighter({
      id: 'broken',
      order: 1,
      highlight: () => {
        throw new Error('boom')
      },
    })
    definePlutoHighlighter({ id: 'ok', order: 2, highlight: () => 'OK' })
    expect(await highlightPlutoHtml(BLOCK, 'shiki')).toContain('>OK</code>')
    expect(
      await highlightPlutoHtml(BLOCK.replace('ts', 'js'), 'shiki')
    ).toContain('>OK</code>')
    expect(warn).toHaveBeenCalledTimes(2)
  })

  it('reuses a highlighted block', async () => {
    const highlight = vi.fn(() => 'X')
    definePlutoHighlighter({ id: 'test', highlight })
    await highlightPlutoHtml(BLOCK)
    await highlightPlutoHtml(BLOCK)
    expect(highlight).toHaveBeenCalledTimes(1)
  })
})

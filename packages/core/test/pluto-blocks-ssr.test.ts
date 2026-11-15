import type { MarkdownDocument } from 'comark'
import { MarkdownDocument as RenderDocument } from '@comark/vue'
import { describe, expect, it } from 'vitest'
import { createSSRApp, defineComponent, h, Suspense } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { parsePlutoBlocks } from '../server/utils/pluto-blocks'

const Panel = defineComponent({
  props: { title: { type: String, default: '' } },
  setup(props, { slots }) {
    return () =>
      h('section', { 'data-panel': '' }, [
        h('h2', props.title),
        slots.default?.(),
      ])
  },
})

async function render(document: MarkdownDocument): Promise<string> {
  const app = createSSRApp({
    render: () =>
      h(Suspense, null, {
        default: () =>
          h(RenderDocument, {
            value: document,
            componentsManifest: (tag: string) =>
              tag === 'panel'
                ? Promise.resolve({ __esModule: true, default: Panel })
                : undefined,
          }),
      }),
  })
  return renderToString(app)
}

describe('rendering a blocks document on the server', () => {
  it('renders a component from the manifest with its prop and slot', async () => {
    const document = await parsePlutoBlocks(
      '::panel{title="Crew"}\nInside **slot**\n::'
    )

    const html = await render(document)

    expect(html).toContain('<section data-panel>')
    expect(html).toContain('<h2>Crew</h2>')
    expect(html).toContain('<strong>slot</strong>')
  })

  it('renders no script from the body', async () => {
    const document = await parsePlutoBlocks('Hi\n\n<script>alert(1)</script>')

    expect(await render(document)).not.toContain('<script')
  })
})

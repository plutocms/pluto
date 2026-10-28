// The kind of each line of an MDC page, for the colors of the Markdown editor:
// the component lines (`::name` and the closing `::`), the slot lines
// (`#title`), the YAML props of a component (between `---` lines just after
// its opening line), and the code fences with their content. Markdown has no
// such lines, so the editor marks them itself. Pure: no DOM.

export type PlutoMdcLineKind = 'component' | 'slot' | 'props' | 'code'

const COMPONENT_OPEN = /^\s*:{2,}[A-Z][\w-]*/i
const COMPONENT_CLOSE = /^\s*:{2,}\s*$/
const SLOT = /^\s*#[A-Z][\w-]*\s*$/i
const FENCE = /^\s*(`{3,}|~{3,})/
const YAML_FENCE = /^\s*---\s*$/

/** One kind (or `undefined`) for each line of `text`, in order. */
export function mdcLineKinds(
  text: string
): Array<PlutoMdcLineKind | undefined> {
  const lines = text.split('\n')
  const kinds: Array<PlutoMdcLineKind | undefined> = []
  let fence: string | null = null
  let props: 'none' | 'next' | 'open' = 'none'

  for (const line of lines) {
    if (fence) {
      kinds.push('code')
      if (
        line.trim().startsWith(fence) &&
        !line.trim().slice(fence.length).trim()
      ) {
        fence = null
      }
      continue
    }
    if (props === 'open') {
      kinds.push('props')
      if (YAML_FENCE.test(line)) {
        props = 'none'
      }
      continue
    }
    if (props === 'next' && YAML_FENCE.test(line)) {
      kinds.push('props')
      props = 'open'
      continue
    }
    props = 'none'

    const opened = FENCE.exec(line)
    if (opened) {
      fence = opened[1]!
      kinds.push('code')
    } else if (COMPONENT_OPEN.test(line)) {
      kinds.push('component')
      props = 'next'
    } else if (COMPONENT_CLOSE.test(line)) {
      kinds.push('component')
    } else if (SLOT.test(line)) {
      kinds.push('slot')
    } else {
      kinds.push(undefined)
    }
  }
  return kinds
}

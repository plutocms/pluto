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

/** The part of an MDC line that a token colors. */
export type PlutoMdcTokenKind =
  'punct' | 'name' | 'attr' | 'string' | 'literal' | 'slot'

export interface PlutoMdcToken {
  from: number
  to: number
  kind: PlutoMdcTokenKind
}

// One attribute of `{...}`: a key (`title`, `:count`, `#id`, `.class`), and maybe `=` and a value
// (quoted, or a bare word).
const ATTRIBUTE = /([:#.]?[\w-]+)(?:\s*(=)\s*("[^"]*"|'[^']*'|[^\s}]+))?/g
const LITERAL = /^(?:true|false|null|-?\d+(?:\.\d+)?)$/

function attributeTokens(
  text: string,
  start: number,
  tokens: PlutoMdcToken[]
): void {
  for (const match of text.matchAll(ATTRIBUTE)) {
    const at = start + match.index!
    const [, key = '', equals, value] = match
    tokens.push({ from: at, to: at + key.length, kind: 'attr' })
    if (equals && value) {
      const valueAt = at + match[0].lastIndexOf(value)
      tokens.push({
        from: at + match[0].indexOf('=', key.length),
        to: at + match[0].indexOf('=', key.length) + 1,
        kind: 'punct',
      })
      tokens.push({
        from: valueAt,
        to: valueAt + value.length,
        kind: LITERAL.test(value) ? 'literal' : 'string',
      })
    }
  }
}

/**
 * The colored parts of one MDC line of `kind` (from `mdcLineKinds`): the colons, the name and the
 * braces of a component with its attributes (`::callout{type="tip" :count=2}`), the `#` and the
 * name of a slot, the key and the value of a YAML prop. Offsets are in the line. Pure: no DOM.
 */
export function mdcLineTokens(
  line: string,
  kind: PlutoMdcLineKind | undefined
): PlutoMdcToken[] {
  const tokens: PlutoMdcToken[] = []
  if (kind === 'component') {
    const match = /^(\s*)(:{2,})([\w-]*)(\{.*\})?/.exec(line)
    if (!match) {
      return tokens
    }
    const [, indent = '', colons = '', name = '', braces] = match
    let at = indent.length
    tokens.push({ from: at, to: at + colons.length, kind: 'punct' })
    at += colons.length
    if (name) {
      tokens.push({ from: at, to: at + name.length, kind: 'name' })
      at += name.length
    }
    if (braces) {
      tokens.push({ from: at, to: at + 1, kind: 'punct' })
      attributeTokens(braces.slice(1, -1), at + 1, tokens)
      tokens.push({
        from: at + braces.length - 1,
        to: at + braces.length,
        kind: 'punct',
      })
    }
    return tokens
  }
  if (kind === 'slot') {
    const match = /^(\s*)#([\w-]+)/.exec(line)
    if (match) {
      const at = match[1]!.length
      tokens.push({ from: at, to: at + 1, kind: 'punct' })
      tokens.push({ from: at + 1, to: at + 1 + match[2]!.length, kind: 'slot' })
    }
    return tokens
  }
  if (kind === 'props') {
    if (YAML_FENCE.test(line)) {
      const at = line.indexOf('-')
      tokens.push({ from: at, to: at + 3, kind: 'punct' })
      return tokens
    }
    const match = /^(\s*(?:-\s+)?)([\w-]+)(\s*:)(\s*)(\S.*)?$/.exec(line)
    if (!match) {
      return tokens
    }
    const [, indent = '', key = '', colon = '', space = '', value = ''] = match
    let at = indent.length
    tokens.push({ from: at, to: at + key.length, kind: 'attr' })
    at += key.length
    tokens.push({ from: at, to: at + colon.length, kind: 'punct' })
    at += colon.length + space.length
    if (value.trim()) {
      tokens.push({
        from: at,
        to: at + value.trimEnd().length,
        kind: LITERAL.test(value.trim()) ? 'literal' : 'string',
      })
    }
  }
  return tokens
}

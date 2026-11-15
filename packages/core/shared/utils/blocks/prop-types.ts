import type { ElementNode, Node } from 'comark'
import type { PlutoBlockDefinition } from './definition'
import { sameKey } from './definition'

type PropMap = Record<string, unknown>

function coerceValue(type: string | undefined, value: unknown): unknown {
  if (typeof value !== 'string') {
    return value
  }
  if (type === 'number') {
    const parsed = Number(value)
    return value.trim() !== '' && Number.isFinite(parsed) ? parsed : value
  }
  if (type === 'boolean') {
    if (value === 'true') {
      return true
    }
    return value === 'false' ? false : value
  }
  return value
}

/**
 * Converts the text props of a parsed component to the types its definition declares:
 * `number` props become numbers, `boolean` props become booleans. A bare attribute
 * (`:center="true"`) becomes `center: true`. Other props and unparsable values stay as they are.
 */
export function coerceBlockProps(
  props: PropMap,
  definition: Pick<PlutoBlockDefinition, 'props'> | undefined
): PropMap {
  const declared = definition?.props
  if (!declared) {
    return props
  }
  const out: PropMap = {}
  for (const [key, value] of Object.entries(props)) {
    const bare = key.startsWith(':') ? key.slice(1) : key
    const type = declared[sameKey(declared, bare)]?.type
    const coerced = coerceValue(type, value)
    if (key.startsWith(':') && coerced !== value) {
      out[bare] = coerced
    } else {
      out[key] = coerced
    }
  }
  return out
}

function isElement(node: Node): node is ElementNode {
  return Array.isArray(node) && typeof node[0] === 'string'
}

export function coerceNodeProps(
  nodes: Node[],
  definitionOf: (tag: string) => PlutoBlockDefinition | undefined
): Node[] {
  return nodes.map((node): Node => {
    if (!isElement(node)) {
      return node
    }
    const children = coerceNodeProps(node.slice(2) as Node[], definitionOf)
    return [
      node[0],
      coerceBlockProps(node[1], definitionOf(node[0])),
      ...children,
    ]
  })
}

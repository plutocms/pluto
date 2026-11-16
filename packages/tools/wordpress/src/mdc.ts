import type { BlockNode, PropValue } from './types'
import { RAW_HTML } from './types'

function kebab(name: string): string {
  return name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)
}

function quote(value: string): string {
  const line = value.replace(/\s*\n\s*/g, ' ')

  if (!line.includes('"')) {
    return `"${line}"`
  }

  return `'${line.replace(/'/g, '\u2019')}'`
}

function prop(name: string, value: PropValue): string {
  const key = kebab(name)

  if (value === true) {
    return key
  }

  if (value === false) {
    return `:${key}="false"`
  }

  return `${key}=${quote(String(value))}`
}

function opener(node: BlockNode, colons: number): string {
  const props = Object.entries(node.props)
    .filter((entry): entry is [string, PropValue] => entry[1] !== undefined)
    .map(([name, value]) => prop(name, value))

  return `${':'.repeat(colons)}${node.name}${props.length > 0 ? `{${props.join(' ')}}` : ''}`
}

function slotText(value: string): string {
  return value
    .trim()
    .split('\n')
    .map((line, index) => {
      if (line.startsWith('::')) {
        return `\\${line}`
      }

      return index === 0 && /^-{3,}\s*$/.test(line) ? '***' : line
    })
    .join('\n')
}

function rawHtml(value: string): string {
  return value
    .trim()
    .replace(/\r\n?/g, '\n')
    .replace(/\n[ \t]*(?:\n[ \t]*)+/g, '\n')
}

/** How many colons the opener of a block needs: more than any block inside it. */
export function colonsOf(node: BlockNode): number {
  const children = node.children ?? []

  if (children.length === 0) {
    return 2
  }

  return 1 + Math.max(...children.map((child) => colonsOf(child)))
}

function serializeNode(node: BlockNode): string {
  if (node.name === RAW_HTML) {
    return rawHtml(node.text ?? '')
  }

  const colons = colonsOf(node)
  const lines = [opener(node, colons)]

  if (node.text !== undefined && node.text.trim() !== '') {
    lines.push(slotText(node.text))
  }

  if (node.children && node.children.length > 0) {
    lines.push(node.children.map((child) => serializeNode(child)).join('\n\n'))
  }

  lines.push(':'.repeat(colons))

  return lines.join('\n')
}

/** Writes block nodes as MDC, by the rules of the `blocks-kit` skill. */
export function serializeBlocks(nodes: BlockNode[]): string {
  return nodes.map((node) => serializeNode(node)).join('\n\n')
}

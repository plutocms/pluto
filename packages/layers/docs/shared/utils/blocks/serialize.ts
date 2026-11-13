import type {
  PlutoBlock,
  PlutoBlockDoc,
  PlutoCodeBlock,
  PlutoComponentBlock,
} from './types'
import {
  completeOrder,
  isSameProps,
  renderInlineProps,
  renderYamlProps,
} from '#layers/pluto/shared/utils/blocks/mdc-props'
import { flatChildren } from './tree'

function indentLines(text: string, indent: string): string {
  if (!indent) {
    return text
  }
  return text
    .split('\n')
    .map((line, index) => (index > 0 && line !== '' ? indent + line : line))
    .join('\n')
}

function renderCode(block: PlutoCodeBlock): string {
  const char = block.fence[0] ?? '`'
  let fence = block.fence.length >= 3 ? block.fence : char.repeat(3)
  // A line of the code that looks like the fence needs a longer fence.
  for (const line of block.code.split('\n')) {
    const match = /^\s*([`~]{3,})\s*$/.exec(line)
    if (match && match[1]![0] === char && match[1]!.length >= fence.length) {
      fence = char.repeat(match[1]!.length + 1)
    }
  }
  const info = [
    block.lang,
    block.filename === undefined ? '' : `[${block.filename}]`,
    block.meta ?? '',
  ]
    .filter(Boolean)
    .join(' ')
  const body = block.code === '' ? '' : `\n${block.code}`
  return indentLines(`${fence}${info}${body}\n${fence}`, block.indent ?? '')
}

function renderOpener(block: PlutoComponentBlock): string {
  if (isSameProps(block.props, block.propOrder, block.propSource)) {
    return block.openerText
  }
  const order = completeOrder(block.props, block.propOrder)
  const head = `${':'.repeat(block.colons)}${block.name}`
  if (block.propsStyle === 'yaml' && block.yamlHead !== undefined) {
    const entries = renderYamlProps(block.props, order, block.propSource)
    if (entries.length === 0) {
      return head
    }
    const fenceIndent = block.yamlHead.slice(
      block.yamlHead.lastIndexOf('\n') + 1
    )
    const yamlIndent = block.yamlIndent ?? ''
    const inner = entries
      .map((entry) => yamlIndent + indentLines(entry, yamlIndent))
      .join('\n')
    return `${head}${block.yamlHead}---\n${inner}\n${fenceIndent}---`
  }
  const body = renderInlineProps(block.props, order, block.propSource)
  return body ? `${head}{${body}}` : head
}

function renderComponent(block: PlutoComponentBlock): string {
  const children = flatChildren(block)
  let out = renderOpener(block)
  for (const [index, child] of children.entries()) {
    out += (block.gaps[index] ?? '') + renderBlock(child)
  }
  return `${out}${block.gaps[children.length] ?? ''}${':'.repeat(block.colons)}`
}

export function renderBlock(block: PlutoBlock): string {
  if (block.original) {
    return block.original.text
  }
  switch (block.kind) {
    case 'text':
    case 'raw':
      return indentLines(block.markdown, block.indent ?? '')
    case 'code':
      return renderCode(block)
    case 'component':
      return renderComponent(block)
  }
}

export function serializeBlocks(doc: PlutoBlockDoc): string {
  let out = doc.gaps[0] ?? ''
  for (const [index, block] of doc.blocks.entries()) {
    out += renderBlock(block) + (doc.gaps[index + 1] ?? '')
  }
  return out
}

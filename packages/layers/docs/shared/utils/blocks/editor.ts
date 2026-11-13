import type { PlutoPreviewBlock, PlutoPreviewChild } from './preview-protocol'
import type {
  PlutoBlock,
  PlutoBlockDefinition,
  PlutoBlockDoc,
  PlutoBlockSources,
  PlutoComponentBlock,
} from './types'
import { blockMarkdown } from './operations'
import { BLOCK_KIND_LABELS } from './presets'
import { listPaletteBlocks, resolveBlockDefinition } from './registry'
import { renderBlock } from './serialize'
import { findBlock, flatChildren, pathOf } from './tree'

export interface PlutoBlockInfo {
  /** A plain text or an i18n key. */
  label: string
  icon: string
  /** A short plain text from the content of the block. */
  excerpt: string
  /** The name of the component, for a component block. */
  name?: string
}

const HEADING = /^#{1,6} +(\S.*)$/m

export function plainExcerpt(markdown: string, max = 48): string {
  const text = markdown
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[`*_~>#]/g, '')
    .replace(/\{[^}]*\}/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text
}

function textExcerpt(markdown: string): string {
  const heading = HEADING.exec(markdown)
  if (heading) {
    return plainExcerpt(heading[1]!.replace(/ +#+$/, ''))
  }
  const first = markdown
    .split('\n')
    .find((line) => line.trim() !== '' && !/^\s*(?:---|:::?)/.test(line))
  return plainExcerpt(first ?? '')
}

function firstText(component: PlutoComponentBlock): string {
  for (const child of flatChildren(component)) {
    if (child.kind === 'text') {
      return textExcerpt(child.markdown)
    }
  }
  return ''
}

export function describeBlock(
  block: PlutoBlock,
  sources: PlutoBlockSources = {}
): PlutoBlockInfo {
  switch (block.kind) {
    case 'text': {
      const heading = HEADING.test(block.markdown)
      return {
        label: BLOCK_KIND_LABELS.text,
        icon: heading ? 'i-lucide-heading' : 'i-lucide-pilcrow',
        excerpt: textExcerpt(block.markdown),
      }
    }
    case 'code':
      return {
        label: BLOCK_KIND_LABELS.code,
        icon: 'i-lucide-code-xml',
        excerpt: block.filename || block.lang || '',
      }
    case 'raw':
      return {
        label:
          block.reason === 'table'
            ? 'docs.blocks.kinds.table'
            : BLOCK_KIND_LABELS.raw,
        icon:
          block.reason === 'table' ? 'i-lucide-table' : 'i-lucide-file-text',
        excerpt: block.reason === 'table' ? '' : textExcerpt(block.markdown),
      }
    case 'component': {
      const definition = resolveBlockDefinition(block.name, { sources })
      const title =
        typeof block.props.title === 'string'
          ? block.props.title
          : typeof block.props.label === 'string'
            ? block.props.label
            : ''
      return {
        label: definition.label,
        icon: definition.icon,
        excerpt: plainExcerpt(title || firstText(block)),
        name: block.name,
      }
    }
  }
}

export function slotMarkdown(
  component: PlutoComponentBlock,
  slot: string
): string {
  return (component.slots[slot] ?? [])
    .map((child) => blockMarkdown(child))
    .join('\n\n')
}

export type PlutoSlotMode = 'rich' | 'inline' | 'blocks' | 'markdown'

export function resolveSlotMode(
  component: PlutoComponentBlock,
  slot: string,
  wanted: 'rich' | 'inline' | 'blocks' | undefined
): PlutoSlotMode {
  const children = component.slots[slot] ?? []
  if (wanted === 'blocks') {
    return 'blocks'
  }
  if (
    !children.every((child) => child.kind === 'text' || child.kind === 'raw')
  ) {
    return 'blocks'
  }
  // The parser turns prose that the text editor would lose into a raw block. Markdown keeps it as it is.
  if (children.some((child) => child.kind === 'raw')) {
    return 'markdown'
  }
  const markdown = slotMarkdown(component, slot)
  if (wanted === 'inline') {
    return markdown.includes('\n') ? 'markdown' : 'inline'
  }
  return 'rich'
}

export function previewSelectionId(
  doc: PlutoBlockDoc,
  id: string | null
): string | null {
  if (!id) {
    return null
  }
  const path = pathOf(doc, id)
  for (let index = path.length - 1; index > 0; index--) {
    if (findBlock(doc, path[index]!)?.block.kind === 'component') {
      return path[index]!
    }
  }
  return path[0] ?? null
}

export function toPreviewBlocks(
  blocks: PlutoBlock[],
  sources: PlutoBlockSources = {}
): PlutoPreviewBlock[] {
  return blocks.map((block) => {
    const markdown = renderBlock(block)
    if (block.kind !== 'component') {
      return { id: block.id, markdown }
    }
    const definition = resolveBlockDefinition(block.name, { sources })
    const children = previewChildren(block, sources)
    return {
      id: block.id,
      markdown,
      label: definition.label,
      ...(definition.preview === false ? { preview: false } : {}),
      ...(children.length ? { children } : {}),
    }
  })
}

function previewChildren(
  component: PlutoComponentBlock,
  sources: PlutoBlockSources = {}
): PlutoPreviewChild[] {
  return flatChildren(component)
    .filter((child): child is PlutoComponentBlock => child.kind === 'component')
    .map((child) => {
      const children = previewChildren(child, sources)
      return {
        id: child.id,
        name: child.name,
        label: resolveBlockDefinition(child.name, { sources, block: child })
          .label,
        ...(children.length ? { children } : {}),
      }
    })
}

export function acceptedNames(
  definition: PlutoBlockDefinition,
  slot: string
): string[] | undefined {
  return definition.slots?.[slot]?.accepts
}

export type PlutoPaletteEntry =
  | {
      id: string
      kind: 'text'
      group: string
      label: string
      description: string
      icon: string
      markdown: string
    }
  | {
      id: string
      kind: 'code'
      group: string
      label: string
      description: string
      icon: string
      markdown: string
    }
  | {
      id: string
      kind: 'table'
      group: string
      label: string
      description: string
      icon: string
      markdown: string
    }
  | {
      id: string
      kind: 'component'
      group: string
      label: string
      description: string
      icon: string
      name: string
      markdown: string
    }

export interface PlutoPaletteGroup {
  group: string
  entries: PlutoPaletteEntry[]
}

const TABLE_MARKDOWN =
  '| Column | Column |\n| ------ | ------ |\n| Cell | Cell |'

export function buildPalette(
  sources: PlutoBlockSources = {},
  accepts?: string[]
): PlutoPaletteGroup[] {
  const groups: PlutoPaletteGroup[] = []
  if (!accepts) {
    groups.push({
      group: 'text',
      entries: [
        {
          id: 'builtin:text',
          kind: 'text',
          group: 'text',
          label: BLOCK_KIND_LABELS.text,
          description: 'docs.blocks.kinds.textDescription',
          icon: 'i-lucide-pilcrow',
          markdown: '## Title\n\nWrite your text here.',
        },
        {
          id: 'builtin:table',
          kind: 'table',
          group: 'text',
          label: 'docs.blocks.kinds.table',
          description: 'docs.blocks.kinds.tableDescription',
          icon: 'i-lucide-table',
          markdown: TABLE_MARKDOWN,
        },
      ],
    })
    groups.push({
      group: 'code',
      entries: [
        {
          id: 'builtin:code',
          kind: 'code',
          group: 'code',
          label: BLOCK_KIND_LABELS.code,
          description: 'docs.blocks.kinds.codeDescription',
          icon: 'i-lucide-code-xml',
          markdown: "```ts\nconst hello = 'world'\n```",
        },
      ],
    })
  }
  for (const { group, items } of listPaletteBlocks(sources)) {
    const entries = items
      .filter((item) => !accepts || accepts.includes(item.name))
      .map((item): PlutoPaletteEntry => ({
        id: `component:${item.name}`,
        kind: 'component',
        group,
        label: item.label,
        description: item.description ?? '',
        icon: item.icon,
        name: item.name,
        markdown: item.insert ?? `::${item.name}\n::`,
      }))
    if (entries.length === 0) {
      continue
    }
    const existing = groups.find((candidate) => candidate.group === group)
    if (existing) {
      existing.entries.push(...entries)
    } else {
      groups.push({ group, entries })
    }
  }
  return groups
}

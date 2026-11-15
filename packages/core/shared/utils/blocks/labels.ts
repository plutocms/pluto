export const BLOCK_GROUPS = [
  'text',
  'callouts',
  'media',
  'layout',
  'code',
  'landing',
  'site',
] as const

export const BLOCK_KIND_LABELS = {
  text: 'pluto.blocks.kinds.text',
  code: 'pluto.blocks.kinds.code',
  raw: 'pluto.blocks.kinds.raw',
} as const

export const HIDDEN_PROP_NAMES = ['ui', 'as'] as const

export function groupLabelKey(group: string): string {
  return (BLOCK_GROUPS as readonly string[]).includes(group)
    ? `pluto.blocks.groups.${group}`
    : group
}

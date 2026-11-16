import type { BlockNode } from './types'

const TEXT_BLOCKS = new Set(['block-heading', 'block-text', 'block-counter'])

const DARK = 0.4

function channels(color: string): [number, number, number] | undefined {
  const hex = /^#([0-9a-f]{3,8})$/i.exec(color)?.[1]

  if (hex && [3, 4, 6, 8].includes(hex.length)) {
    const full =
      hex.length <= 4 ? [...hex].map((digit) => digit + digit).join('') : hex

    return [0, 2, 4].map((index) =>
      Number.parseInt(full.slice(index, index + 2), 16)
    ) as [number, number, number]
  }

  const rgb = /^rgba?\(([^)]+)\)$/i.exec(color)?.[1]

  if (rgb) {
    const parts = rgb.split(/[\s,/]+/).map(Number)

    if (parts.length >= 3 && parts.slice(0, 3).every(Number.isFinite)) {
      return [parts[0]!, parts[1]!, parts[2]!]
    }
  }

  return undefined
}

/** The relative luminance of a hex or `rgb()` color, from 0 (black) to 1 (white). */
export function luminanceOf(color: string): number | undefined {
  const rgb = channels(color)

  if (!rgb) {
    return undefined
  }

  const [red, green, blue] = rgb.map((value) => {
    const unit = value / 255

    return unit <= 0.03928 ? unit / 12.92 : ((unit + 0.055) / 1.055) ** 2.4
  }) as [number, number, number]

  return 0.2126 * red + 0.7152 * green + 0.0722 * blue
}

function isDark(color: unknown): boolean {
  const luminance = typeof color === 'string' ? luminanceOf(color) : undefined

  return luminance !== undefined && luminance < DARK
}

function darkSurface(props: BlockNode['props']): boolean {
  if (props.image) {
    return props.overlay ? isDark(props.overlay) : true
  }

  return isDark(props.bg)
}

function textBlocks(nodes: BlockNode[]): BlockNode[] {
  return nodes.flatMap((node) => [
    ...(TEXT_BLOCKS.has(node.name) ? [node] : []),
    ...textBlocks(node.children ?? []),
  ])
}

/**
 * When every heading, text and counter of a section that sets a color sets the same one, and the
 * section has a dark background or an image, the color moves to the section. The blocks that set
 * no color (a placeholder) then inherit it too.
 */
export function liftSectionColor(section: BlockNode): void {
  if (section.props.color || !darkSurface(section.props)) {
    return
  }

  const colored = textBlocks(section.children ?? []).filter(
    (node) => node.props.color
  )
  const colors = new Set(colored.map((node) => node.props.color))

  if (colors.size !== 1) {
    return
  }

  section.props.color = colored[0]!.props.color

  for (const node of colored) {
    node.props.color = undefined
  }
}

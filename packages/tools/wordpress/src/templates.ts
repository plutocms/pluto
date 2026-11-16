import type { ElementorElement, WxrPost } from './types'

export type TemplateKind = 'header' | 'footer'

const NAV_WIDGETS = new Set(['navigation-menu', 'nav-menu'])

/**
 * Tells a header or a footer from another template. A "Header Footer Elementor" post says it in
 * `ehf_template_type`. A theme builder template says it in `_elementor_template_type`.
 */
export function templateKind(post: WxrPost): TemplateKind | undefined {
  if (post.type === 'elementor-hf') {
    const type = (post.meta.ehf_template_type ?? '').toLowerCase()
    const label = type || post.title.toLowerCase()

    if (label.includes('before')) {
      return undefined
    }

    if (label.includes('footer')) {
      return 'footer'
    }

    return label.includes('header') ? 'header' : undefined
  }

  if (post.type === 'elementor_library') {
    const type = post.meta._elementor_template_type

    return type === 'footer' || type === 'header' ? type : undefined
  }

  return undefined
}

function walk(
  elements: ElementorElement[],
  visit: (element: ElementorElement) => void
) {
  for (const element of elements) {
    visit(element)
    walk(element.elements ?? [], visit)
  }
}

/** How many widgets of each type a template has. */
export function widgetCounts(
  elements: ElementorElement[]
): Record<string, number> {
  const counts: Record<string, number> = {}

  walk(elements, (element) => {
    if (element.elType === 'widget') {
      const type = element.widgetType ?? 'unknown'

      counts[type] = (counts[type] ?? 0) + 1
    }
  })

  return counts
}

/** The slug of the menu that the first navigation widget shows. */
export function navMenuOf(elements: ElementorElement[]): string | undefined {
  let found: string | undefined

  walk(elements, (element) => {
    const menu = element.settings?.menu

    if (
      !found &&
      NAV_WIDGETS.has(element.widgetType ?? '') &&
      typeof menu === 'string' &&
      menu
    ) {
      found = menu
    }
  })

  return found
}

// The blocks that work with no site config: the Nuxt UI prose components and
// the Nuxt UI page components that a Markdown page can use. Pure data. Each
// label and description is an i18n key of the layer, in the group
// docs.blocks.<name>. A prop or a slot name shared by many blocks has
// one key in the groups props and slots of the same namespace.

import type {
  PlutoBlockDefinition,
  PlutoBlockPropDefinition,
  PlutoBlockPropOption,
  PlutoBlockPropType,
  PlutoBlockSlotContent,
  PlutoBlockSlotDefinition,
} from './types'
import { MDC_SNIPPETS } from '../mdc-snippets'

/** The group ids of the palette, in order. A site can use any other text as a group. */
export const BLOCK_GROUPS = [
  'text',
  'callouts',
  'layout',
  'code',
  'landing',
  'site',
] as const

/** The labels of the three built-in kinds of block. */
export const BLOCK_KIND_LABELS = {
  text: 'docs.blocks.kinds.text',
  code: 'docs.blocks.kinds.code',
  raw: 'docs.blocks.kinds.raw',
} as const

export function groupLabelKey(group: string): string {
  return (BLOCK_GROUPS as readonly string[]).includes(group)
    ? `docs.blocks.groups.${group}`
    : group
}

/** The theme colors of Nuxt UI. */
export const BLOCK_COLORS = [
  'primary',
  'secondary',
  'success',
  'info',
  'warning',
  'error',
  'neutral',
]
const TARGETS = ['_self', '_blank']

function prop(
  type: PlutoBlockPropType,
  name: string,
  extra: Partial<PlutoBlockPropDefinition> = {}
): PlutoBlockPropDefinition {
  return { type, label: `docs.blocks.props.${name}`, ...extra }
}

function options(values: string[]): PlutoBlockPropOption[] {
  return values.map((value) => ({ value }))
}

function slot(
  name: string,
  content: PlutoBlockSlotContent,
  accepts?: string[]
): PlutoBlockSlotDefinition {
  return {
    label: `docs.blocks.slots.${name}`,
    content,
    ...(accepts ? { accepts } : {}),
  }
}

function snippet(id: string): string {
  return MDC_SNIPPETS.find((item) => item.id === id)!.text
}

function block(
  name: string,
  group: string,
  icon: string,
  extra: Partial<PlutoBlockDefinition> = {}
): PlutoBlockDefinition {
  return {
    name,
    label: `docs.blocks.${name}.label`,
    description: `docs.blocks.${name}.description`,
    icon,
    group,
    ...extra,
  }
}

const calloutProps = {
  icon: prop('icon', 'icon'),
  to: prop('link', 'to', { advanced: true }),
  target: prop('select', 'target', {
    options: options(TARGETS),
    advanced: true,
  }),
}

const DEFINITIONS: PlutoBlockDefinition[] = [
  block('note', 'callouts', 'i-lucide-info', {
    props: { ...calloutProps },
    slots: { default: slot('default', 'rich') },
    insert: snippet('note'),
  }),
  block('tip', 'callouts', 'i-lucide-lightbulb', {
    props: { ...calloutProps },
    slots: { default: slot('default', 'rich') },
    insert: snippet('tip'),
  }),
  block('warning', 'callouts', 'i-lucide-triangle-alert', {
    props: { ...calloutProps },
    slots: { default: slot('default', 'rich') },
    insert: snippet('warning'),
  }),
  block('caution', 'callouts', 'i-lucide-octagon-alert', {
    props: { ...calloutProps },
    slots: { default: slot('default', 'rich') },
    insert: snippet('caution'),
  }),
  block('callout', 'callouts', 'i-lucide-message-square-quote', {
    props: {
      icon: prop('icon', 'icon'),
      color: prop('select', 'color', { options: options(BLOCK_COLORS) }),
      to: prop('link', 'to', { advanced: true }),
      target: prop('select', 'target', {
        options: options(TARGETS),
        advanced: true,
      }),
    },
    slots: { default: slot('default', 'rich') },
    insert: snippet('callout'),
  }),
  block('card', 'layout', 'i-lucide-square', {
    props: {
      title: prop('string', 'title'),
      icon: prop('icon', 'icon'),
      color: prop('select', 'color', { options: options(BLOCK_COLORS) }),
      to: prop('link', 'to'),
      target: prop('select', 'target', {
        options: options(TARGETS),
        advanced: true,
      }),
    },
    slots: { default: slot('default', 'rich') },
    insert:
      '::card\n---\ntitle: Title\nicon: i-lucide-box\n---\nText of the card.\n::',
  }),
  block('card-group', 'layout', 'i-lucide-layout-grid', {
    slots: { default: slot('default', 'blocks', ['card']) },
    insert: snippet('card-group'),
  }),
  block('steps', 'layout', 'i-lucide-list-ordered', {
    props: {
      level: prop('select', 'level', { options: options(['2', '3', '4']) }),
    },
    slots: { default: slot('default', 'rich') },
    insert: snippet('steps'),
  }),
  block('accordion', 'layout', 'i-lucide-chevrons-up-down', {
    props: {
      type: prop('select', 'accordionType', {
        options: options(['single', 'multiple']),
      }),
    },
    slots: { default: slot('default', 'blocks', ['accordion-item']) },
    insert: snippet('accordion'),
  }),
  block('accordion-item', 'layout', 'i-lucide-chevron-down', {
    props: {
      label: prop('string', 'label'),
      icon: prop('icon', 'icon'),
      description: prop('string', 'description'),
    },
    slots: { default: slot('default', 'rich') },
    insert:
      '::accordion-item{label="Question" icon="i-lucide-circle-help"}\nAnswer.\n::',
  }),
  block('tabs', 'layout', 'i-lucide-panel-top', {
    props: { sync: prop('string', 'sync', { advanced: true }) },
    slots: { default: slot('default', 'blocks', ['tabs-item']) },
    insert: snippet('tabs'),
  }),
  block('tabs-item', 'layout', 'i-lucide-panel-top-open', {
    props: {
      label: prop('string', 'label'),
      icon: prop('icon', 'icon'),
      description: prop('string', 'description'),
    },
    slots: { default: slot('default', 'rich') },
    insert:
      '::tabs-item{label="Tab" icon="i-lucide-file"}\nText of the tab.\n::',
  }),
  block('collapsible', 'layout', 'i-lucide-chevrons-down-up', {
    props: {
      name: prop('string', 'name'),
      openText: prop('string', 'openText', { advanced: true }),
      closeText: prop('string', 'closeText', { advanced: true }),
    },
    slots: { default: slot('default', 'rich') },
    insert: '::collapsible\nHidden text.\n::',
  }),
  block('field-group', 'layout', 'i-lucide-list-tree', {
    slots: { default: slot('default', 'blocks', ['field']) },
    insert: snippet('field-group'),
  }),
  block('field', 'layout', 'i-lucide-text-cursor-input', {
    props: {
      name: prop('string', 'name'),
      type: prop('string', 'fieldType'),
      required: prop('boolean', 'required'),
      description: prop('string', 'description'),
    },
    slots: { default: slot('default', 'rich') },
    insert:
      '::field{name="name" type="string" required}\nText of the field.\n::',
  }),
  block('code-group', 'code', 'i-lucide-square-code', {
    props: { sync: prop('string', 'sync', { advanced: true }) },
    slots: { default: slot('default', 'blocks') },
    insert: snippet('code-group'),
  }),
  block('code-collapse', 'code', 'i-lucide-fold-vertical', {
    props: { name: prop('string', 'name') },
    slots: { default: slot('default', 'blocks') },
    insert: '::code-collapse\n```ts [file.ts]\nconst value = 1\n```\n::',
  }),
  // Inline components. A Markdown page uses them inside a text, so the palette does not list them.
  block('badge', 'text', 'i-lucide-badge', {
    hidden: true,
    props: {
      label: prop('string', 'label'),
      color: prop('select', 'color', { options: options(BLOCK_COLORS) }),
    },
  }),
  block('kbd', 'text', 'i-lucide-keyboard', {
    hidden: true,
    props: { value: prop('string', 'value') },
  }),
  block('icon', 'text', 'i-lucide-smile', {
    hidden: true,
    props: { name: prop('icon', 'name') },
  }),
  block('u-page-hero', 'landing', 'i-lucide-panel-top', {
    props: {
      headline: prop('string', 'headline'),
      title: prop('string', 'title'),
      description: prop('text', 'description'),
      orientation: prop('select', 'orientation', {
        options: options(['vertical', 'horizontal']),
      }),
      reverse: prop('boolean', 'reverse'),
    },
    slots: {
      headline: slot('headline', 'inline'),
      title: slot('title', 'inline'),
      description: slot('description', 'rich'),
      links: slot('links', 'blocks', ['u-button']),
      default: slot('default', 'blocks'),
    },
    insert:
      '::u-page-hero\n#title\nYour title\n\n#description\nA short text about the page.\n::',
  }),
  block('u-page-section', 'landing', 'i-lucide-layout-template', {
    props: {
      headline: prop('string', 'headline'),
      icon: prop('icon', 'icon'),
      title: prop('string', 'title'),
      description: prop('text', 'description'),
      orientation: prop('select', 'orientation', {
        options: options(['vertical', 'horizontal']),
      }),
      reverse: prop('boolean', 'reverse'),
    },
    slots: {
      headline: slot('headline', 'inline'),
      title: slot('title', 'inline'),
      description: slot('description', 'rich'),
      features: slot('features', 'blocks', ['u-page-feature']),
      default: slot('default', 'blocks'),
    },
    insert:
      '::u-page-section\n#title\nYour title\n\n#description\nA short text about the section.\n::',
  }),
  block('u-page-feature', 'landing', 'i-lucide-sparkle', {
    props: {
      title: prop('string', 'title'),
      description: prop('text', 'description'),
      icon: prop('icon', 'icon'),
      to: prop('link', 'to'),
      orientation: prop('select', 'orientation', {
        options: options(['horizontal', 'vertical']),
      }),
    },
    slots: {
      title: slot('title', 'inline'),
      description: slot('description', 'rich'),
    },
    insert:
      '::u-page-feature\n---\nicon: i-lucide-sparkle\n---\n#title\nFeature\n\n#description\nA short text about the feature.\n::',
  }),
  block('u-page-card', 'landing', 'i-lucide-square-stack', {
    props: {
      title: prop('string', 'title'),
      description: prop('text', 'description'),
      icon: prop('icon', 'icon'),
      to: prop('link', 'to'),
      spotlight: prop('boolean', 'spotlight'),
      orientation: prop('select', 'orientation', {
        options: options(['vertical', 'horizontal']),
      }),
    },
    slots: { default: slot('default', 'blocks') },
    insert:
      '::u-page-card\n---\ntitle: Title\ndescription: A short text.\nicon: i-lucide-box\n---\n::',
  }),
  block('u-page-grid', 'landing', 'i-lucide-grid-3x3', {
    slots: { default: slot('default', 'blocks', ['u-page-card']) },
    insert:
      '::u-page-grid\n  :::u-page-card\n  ---\n  title: Title\n  description: A short text.\n  ---\n  :::\n::',
  }),
  block('u-page-c-t-a', 'landing', 'i-lucide-megaphone', {
    props: {
      title: prop('string', 'title'),
      description: prop('text', 'description'),
      variant: prop('select', 'variant', {
        options: options(['outline', 'solid', 'soft', 'subtle', 'naked']),
      }),
      orientation: prop('select', 'orientation', {
        options: options(['vertical', 'horizontal']),
      }),
      reverse: prop('boolean', 'reverse'),
    },
    slots: {
      links: slot('links', 'blocks', ['u-button']),
      default: slot('default', 'blocks'),
    },
    insert:
      '::u-page-c-t-a\n---\ntitle: Ready to start?\ndescription: A short text.\n---\n::',
  }),
  block('u-button', 'landing', 'i-lucide-mouse-pointer-click', {
    props: {
      // A Markdown page often writes the text as the default slot (`:::u-button` ... `Get started`).
      label: prop('string', 'label', { slot: 'default' }),
      to: prop('link', 'to'),
      icon: prop('icon', 'icon'),
      color: prop('select', 'color', { options: options(BLOCK_COLORS) }),
      variant: prop('select', 'variant', {
        options: options([
          'solid',
          'outline',
          'soft',
          'subtle',
          'ghost',
          'link',
        ]),
      }),
      size: prop('select', 'size', {
        options: options(['xs', 'sm', 'md', 'lg', 'xl']),
      }),
      target: prop('select', 'target', {
        options: options(TARGETS),
        advanced: true,
      }),
    },
    insert: '::u-button{label="Button" to="/"}\n::',
  }),
]

/** The presets by component name. */
export const BLOCK_PRESETS: Readonly<Record<string, PlutoBlockDefinition>> =
  Object.freeze(
    Object.fromEntries(
      DEFINITIONS.map((definition) => [definition.name, definition])
    )
  )

/** The props that no preset lists, and that the panel keeps out of the main section. */
export const HIDDEN_PROP_NAMES = ['ui', 'as'] as const

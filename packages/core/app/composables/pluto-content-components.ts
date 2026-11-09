import type {
  PlutoBlockOverride,
  PlutoBlockPropDefinition,
} from '../../shared/utils/blocks/definition'
import {
  blockKey,
  humanizeName,
} from '#layers/pluto/shared/utils/blocks/definition'
import blocks from '#pluto-blocks'

/**
 * A content component as the post editor shows it: a block component of the site (a file of
 * `components/content/` that calls `definePlutoBlock`), or a name in the Markdown that no such file
 * has. See the content-components skill.
 */
export interface PlutoContentComponentInfo {
  /** The block key (kebab case), as the Markdown writes it. */
  name: string
  /** A plain text or an i18n key. */
  label: string
  /** A plain text or an i18n key. */
  description?: string
  icon: string
  /** The props with a widget, from the meta and the macro. */
  props: Record<string, PlutoBlockPropDefinition>
  /** `false` when no block component of the site has this name: the site renders nothing. */
  known: boolean
  /** Not in the insert menu (`hidden: true` in the macro). */
  hidden: boolean
}

const DEFAULT_ICON = 'i-lucide-puzzle'

function infoFrom(
  name: string,
  layer: PlutoBlockOverride | undefined
): PlutoContentComponentInfo {
  const key = blockKey(name)
  const patch = layer || {}
  const props: Record<string, PlutoBlockPropDefinition> = {}
  for (const [prop, definition] of Object.entries(patch.props ?? {})) {
    if (definition) {
      props[prop] = { type: 'string', ...definition }
    }
  }
  return {
    name: key,
    label: patch.label ?? humanizeName(key),
    ...(patch.description ? { description: patch.description } : {}),
    icon: patch.icon ?? DEFAULT_ICON,
    props,
    known: layer !== undefined,
    hidden: layer === false || patch.hidden === true,
  }
}

// The chip of a component that the insert menu just added opens its props form at once.
let openNext = false

/** The next component chip that mounts opens its props form. The insert command calls it. */
export function requestPlutoContentComponentOpen() {
  openNext = true
}

/** `true` once after `requestPlutoContentComponentOpen`. The chip calls it when it mounts. */
export function takePlutoContentComponentOpen(): boolean {
  const value = openNext
  openNext = false
  return value
}

/** The info of one component name of the Markdown (any case). */
export function plutoContentComponentInfo(
  name: string
): PlutoContentComponentInfo {
  return infoFrom(name, blocks[blockKey(name)])
}

/**
 * The block components of the site for the insert menus of the post editors: the known, visible
 * ones, by label. The data is empty on the server (the editors render in the browser).
 */
export function usePlutoContentComponents() {
  const { tx } = usePlutoI18n()
  const list = computed(() =>
    Object.entries(blocks)
      .map(([name, layer]) => infoFrom(name, layer))
      .filter((info) => !info.hidden)
      .sort((a, b) => tx(a.label).localeCompare(tx(b.label)))
  )
  return { list, info: plutoContentComponentInfo }
}

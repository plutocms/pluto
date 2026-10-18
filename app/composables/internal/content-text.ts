// Pure part of `usePlutoContentText`. It does not use Nuxt auto-imports, so
// plain Vitest can import it, and so a composable can call it for each type
// inside one `computed`.
import type { PlutoContentType, PlutoField } from '../../../shared/types/content'
import type { MessageParams } from './i18n-core'

/** The part of `usePlutoI18n()` that content text needs. */
export interface ContentTextI18n {
  t: (key: string, params?: MessageParams | number) => string
  te: (key: string) => boolean
  locale: {
 readonly value: string
}
}

export interface PlutoContentText {
  /** The singular label: the key `content.<name>.label`, else `type.label`. */
  readonly label: string
  /** The plural label: the key `content.<name>.labelPlural`, else `type.labelPlural`. */
  readonly labelPlural: string
  /** The label in lowercase, for use inside a sentence. */
  readonly labelLower: string
  /** The plural label in lowercase, for use inside a sentence. */
  readonly labelPluralLower: string
  /** The "New <label>" text: the key `content.<name>.new`, else the core phrase. */
  readonly newLabel: string
  /** The label of a field: the key `content.<name>.fields.<field>.label`, else `field.label`. */
  fieldLabel: (field: PlutoField) => string
  /** A copy of a field with translated label, description, placeholder and option labels. */
  field: <F extends PlutoField>(field: F) => F
  /** The label of a status value: the key `content.<name>.status.<value>`, else `literal`, else the value. */
  statusLabel: (value: string, literal?: string) => string
}

/**
 * Resolves the convention keys of one content type, with the English literal
 * of the type as the fallback. A key is used only when it exists, so a type
 * that has no key keeps its English text.
 *
 * `getType` runs on each read, so a locale switch or a changed type shows at
 * once when the caller reads inside a reactive scope.
 */
export function createContentText(getType: () => PlutoContentType | undefined, i18n: ContentTextI18n): PlutoContentText {
  const prefix = () => `content.${getType()?.name ?? ''}`

  /** The translation when the key exists, else the literal. */
  function pick<L extends string | undefined>(key: string, literal: L): string | L {
    return i18n.te(key) ? i18n.t(key) : literal
  }

  const lower = (value: string) => value.toLocaleLowerCase(i18n.locale.value)
  const label = () => pick(`${prefix()}.label`, getType()?.label ?? '')
  const labelPlural = () => pick(`${prefix()}.labelPlural`, getType()?.labelPlural ?? '')

  function fieldLabel(field: PlutoField): string {
    return pick(`${prefix()}.fields.${field.name}.label`, field.label)
  }

  function field<F extends PlutoField>(source: F): F {
    const base = `${prefix()}.fields.${source.name}`
    const copy: Record<string, unknown> = { ...source, label: fieldLabel(source) }

    const description = pick(`${base}.description`, source.description)
    if (description !== undefined) {
      copy.description = description
    }

    const placeholder = pick(`${base}.placeholder`, (source as {
 placeholder?: string
}).placeholder)
    if (placeholder !== undefined) {
      copy.placeholder = placeholder
    }

    if (source.type === 'select') {
      copy.options = source.options.map((option) => ({
        ...option,
        label: pick(`${base}.options.${option.value}`, option.label),
      }))
    }

    return copy as F
  }

  return {
    get label() {
      return label()
    },
    get labelPlural() {
      return labelPlural()
    },
    get labelLower() {
      return lower(label())
    },
    get labelPluralLower() {
      return lower(labelPlural())
    },
    get newLabel() {
      const key = `${prefix()}.new`
      return i18n.te(key) ? i18n.t(key) : i18n.t('pluto.content.new', { label: label() })
    },
    fieldLabel,
    field,
    statusLabel: (value, literal) => pick(`${prefix()}.status.${value}`, literal ?? value),
  }
}

/** Same as `createContentText`, for a type that is already in hand. */
export function contentTextFor(type: PlutoContentType, i18n: ContentTextI18n): PlutoContentText {
  return createContentText(() => type, i18n)
}

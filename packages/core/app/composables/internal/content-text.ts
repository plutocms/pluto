import type {
  PlutoContentType,
  PlutoField,
} from '../../../shared/types/content'
import type {
  PlutoMessageKey,
  PlutoTranslateFn,
} from '../../../shared/types/i18n'

export interface ContentTextI18n {
  t: PlutoTranslateFn
  te: (key: string) => key is PlutoMessageKey
  locale: {
    readonly value: string
  }
}

export interface PlutoContentText {
  readonly label: string
  readonly labelPlural: string
  readonly labelLower: string
  readonly labelPluralLower: string
  readonly newLabel: string
  readonly description: string | undefined
  fieldLabel: (field: PlutoField) => string
  field: <F extends PlutoField>(field: F) => F
  statusLabel: (value: string, literal?: string) => string
}

export function createContentText(
  getType: () => PlutoContentType | undefined,
  i18n: ContentTextI18n
): PlutoContentText {
  const prefix = () => `content.${getType()?.name ?? ''}`

  function pick<L extends string | undefined>(
    key: string,
    literal: L
  ): string | L {
    return i18n.te(key) ? i18n.t(key) : literal
  }

  const lower = (value: string) => value.toLocaleLowerCase(i18n.locale.value)
  const label = () => pick(`${prefix()}.label`, getType()?.label ?? '')
  const labelPlural = () =>
    pick(`${prefix()}.labelPlural`, getType()?.labelPlural ?? '')

  function fieldLabel(field: PlutoField): string {
    return pick(`${prefix()}.fields.${field.name}.label`, field.label)
  }

  function field<F extends PlutoField>(source: F): F {
    const base = `${prefix()}.fields.${source.name}`
    const copy: Record<string, unknown> = {
      ...source,
      label: fieldLabel(source),
    }

    const description = pick(`${base}.description`, source.description)
    if (description !== undefined) {
      copy.description = description
    }

    const placeholder = pick(
      `${base}.placeholder`,
      (
        source as {
          placeholder?: string
        }
      ).placeholder
    )
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
    get description() {
      return pick(`${prefix()}.description`, getType()?.description)
    },
    get newLabel() {
      const key = `${prefix()}.new`
      return i18n.te(key)
        ? i18n.t(key)
        : i18n.t('pluto.content.new', { label: label() })
    },
    fieldLabel,
    field,
    statusLabel: (value, literal) =>
      pick(
        `${prefix()}.status.${value}`,
        literal ?? pick(`pluto.status.${value}`, value)
      ),
  }
}

export function contentTextFor(
  type: PlutoContentType,
  i18n: ContentTextI18n
): PlutoContentText {
  return createContentText(() => type, i18n)
}

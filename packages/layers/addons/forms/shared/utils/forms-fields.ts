import type { PlutoFormField, PlutoFormOption } from '../types/forms'

/** The names of the field blocks. A form body accepts only these, and the blocks of custom field types. */
export const PLUTO_FORM_BLOCKS = [
  'form-input',
  'form-textarea',
  'form-select',
  'form-radio',
  'form-checkbox',
  'form-consent',
  'form-hidden',
  'form-submit',
] as const

export const PLUTO_FORM_INPUT_TYPES = [
  'text',
  'email',
  'tel',
  'url',
  'number',
  'date',
] as const

export const PLUTO_FORM_DEFAULT_SUBMIT_LABEL = 'Send'

const NAME_PATTERN = /^[a-z][a-z0-9_]{0,39}$/

const BLOCK_TYPES: Record<string, string> = {
  'form-textarea': 'textarea',
  'form-select': 'select',
  'form-radio': 'radio',
  'form-checkbox': 'checkbox',
  'form-consent': 'consent',
  'form-hidden': 'hidden',
}

const COMMON_PROPS = new Set([
  'name',
  'label',
  'placeholder',
  'help',
  'width',
  'required',
  'pattern',
  'min',
  'max',
  'minLength',
  'maxLength',
  'options',
  'value',
])

type BlockNode = [string, Record<string, unknown>, ...unknown[]]

export interface PlutoFormBlocks {
  nodes?: unknown[]
}

export interface PlutoFormFieldsOptions {
  /** The custom field blocks, as `{ 'form-rating': 'rating' }`: the block name and the field type. */
  custom?: Record<string, string>
}

export interface PlutoFormFieldsResult {
  fields: PlutoFormField[]
  submitLabel: string
}

function isNode(node: unknown): node is BlockNode {
  return (
    Array.isArray(node) &&
    typeof node[0] === 'string' &&
    typeof node[1] === 'object' &&
    node[1] !== null
  )
}

function kebab(name: string): string {
  return name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)
}

function camel(name: string): string {
  return name
    .replace(/^:/, '')
    .replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase())
}

function read(props: Record<string, unknown>, name: string): unknown {
  for (const key of [name, kebab(name), `:${name}`, `:${kebab(name)}`]) {
    if (Object.hasOwn(props, key)) {
      return props[key]
    }
  }
  return undefined
}

function text(value: unknown): string {
  if (typeof value === 'string') {
    return value.trim()
  }
  return typeof value === 'number' ? String(value) : ''
}

function flag(value: unknown): boolean | undefined {
  if (value === true || value === 'true') {
    return true
  }
  if (value === false || value === 'false') {
    return false
  }
  return undefined
}

function whole(value: unknown): number | undefined {
  let number = Number.NaN
  if (typeof value === 'number') {
    number = value
  } else if (typeof value === 'string' && value.trim() !== '') {
    number = Number(value)
  }
  return Number.isFinite(number) ? number : undefined
}

/**
 * Turns a label into a field name: lower case, no accents, `_` between the words. A label with no
 * letter gives an empty text.
 */
export function plutoFormNameFromLabel(label: string): string {
  const name = label
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40)
  return /^[a-z]/.test(name) ? name : ''
}

/**
 * Reads the options of a select or a radio. Separate the options with `;` or a new line. Write
 * `value|Label` to give a value that is not the label.
 */
export function plutoFormOptions(value: unknown): PlutoFormOption[] {
  const seen = new Set<string>()
  const options: PlutoFormOption[] = []
  for (const part of text(value).split(/[;\n]/)) {
    const [first = '', ...rest] = part.split('|')
    const optionValue = first.trim()
    const label = (rest.length > 0 ? rest.join('|') : first).trim()
    if (!optionValue || !label || seen.has(optionValue)) {
      continue
    }
    seen.add(optionValue)
    options.push({ value: optionValue, label })
  }
  return options
}

function uniqueName(name: string, used: Set<string>): string {
  let candidate = name
  let counter = 2
  while (used.has(candidate)) {
    candidate = `${name.slice(0, 36)}_${counter}`
    counter++
  }
  used.add(candidate)
  return candidate
}

function fieldFromNode(
  node: BlockNode,
  type: string,
  used: Set<string>,
  index: number,
  custom: boolean
): PlutoFormField {
  const props = node[1]
  const label = text(read(props, 'label'))
  const given = text(read(props, 'name'))
  const base = NAME_PATTERN.test(given)
    ? given
    : plutoFormNameFromLabel(label) || `field_${index + 1}`
  const field: PlutoFormField = {
    name: uniqueName(base, used),
    type,
    label: label || (type === 'hidden' ? '' : base),
  }

  const placeholder = text(read(props, 'placeholder'))
  const help = text(read(props, 'help'))
  const pattern = text(read(props, 'pattern'))
  const link = text(read(props, 'link'))
  const required = flag(read(props, 'required'))

  if (placeholder) {
    field.placeholder = placeholder
  }
  if (help) {
    field.help = help
  }
  if (text(read(props, 'width')) === 'half') {
    field.width = 'half'
  }
  if (type === 'consent') {
    field.required = required !== false
  } else if (required) {
    field.required = true
  }
  if (pattern) {
    field.pattern = pattern
  }
  if (type === 'select' || type === 'radio' || custom) {
    field.options = plutoFormOptions(read(props, 'options'))
  }
  if (type === 'consent' && link) {
    field.link = link
  }
  if (type === 'hidden') {
    field.value = text(read(props, 'value'))
  }
  for (const key of ['min', 'max', 'minLength', 'maxLength', 'rows'] as const) {
    const number = whole(read(props, key))
    if (number !== undefined) {
      field[key] = number
    }
  }
  if (custom) {
    const extra = Object.fromEntries(
      Object.entries(props).filter(([key]) => !COMMON_PROPS.has(camel(key)))
    )
    if (Object.keys(extra).length > 0) {
      field.props = extra
    }
  }
  return field
}

/**
 * The fields of a form, from the `blocks` of its body (a Comark document). The field blocks give
 * the fields in order, and `form-submit` gives the label of the button. Other blocks are skipped.
 * The server and the browser use the same rules.
 * @example
 * const { fields, submitLabel } = plutoFormFields(form.blocks)
 * @see https://pluto.vulmix.dev/docs/build/forms
 */
export function plutoFormFields(
  blocks: PlutoFormBlocks | null | undefined,
  options: PlutoFormFieldsOptions = {}
): PlutoFormFieldsResult {
  const used = new Set<string>()
  const fields: PlutoFormField[] = []
  let submitLabel = ''

  for (const node of blocks?.nodes ?? []) {
    if (!isNode(node)) {
      continue
    }
    const block = node[0]
    if (block === 'form-submit') {
      submitLabel ||= text(read(node[1], 'label'))
      continue
    }
    const customType = options.custom?.[block]
    if (customType) {
      fields.push(fieldFromNode(node, customType, used, fields.length, true))
      continue
    }
    if (block === 'form-input') {
      const given = text(read(node[1], 'type'))
      const type = (PLUTO_FORM_INPUT_TYPES as readonly string[]).includes(given)
        ? given
        : 'text'
      fields.push(fieldFromNode(node, type, used, fields.length, false))
      continue
    }
    const type = BLOCK_TYPES[block]
    if (type) {
      fields.push(fieldFromNode(node, type, used, fields.length, false))
    }
  }

  return {
    fields,
    submitLabel: submitLabel || PLUTO_FORM_DEFAULT_SUBMIT_LABEL,
  }
}

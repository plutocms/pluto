import type {
  PlutoFormErrors,
  PlutoFormField,
  PlutoFormValues,
} from '../types/forms'

export const PLUTO_FORM_MAX_TEXT = 500

export const PLUTO_FORM_MAX_TEXTAREA = 5000

export const PLUTO_FORM_MAX_BODY_BYTES = 65_536

/** The error codes. A custom validator can return any other text. */
export const PLUTO_FORM_ERROR_CODES = [
  'required',
  'invalid',
  'tooShort',
  'tooLong',
  'tooSmall',
  'tooBig',
  'option',
  'unknown',
] as const

export interface PlutoFormValidateOptions {
  /** The validators of the custom field types, by type name. */
  custom?: Record<
    string,
    ((value: unknown, field: PlutoFormField) => string | undefined) | undefined
  >
}

export interface PlutoFormValidation {
  /** The clean values: a text, a number or a boolean for each field. Empty when `errors` is not. */
  values: PlutoFormValues
  errors: PlutoFormErrors
}

const EMAIL =
  /^[^\s@<>,;:"()[\]\\]+@[^\s"(),:;<>@[\\\]][^\s"(),.:;<>@[\\\]]*\.[^\s"(),:;<>@[\\\]]{2,}$/

const TEL = /^\+?[\d\s().-]{3,30}$/

const DATE = /^\d{4}-\d{2}-\d{2}$/

const TRUE_VALUES = new Set([true, 'true', 'on', '1', 'yes'])

function isEmpty(value: unknown): boolean {
  return (
    value === undefined ||
    value === null ||
    (typeof value === 'string' && value.trim() === '')
  )
}

function limitOf(field: PlutoFormField): number {
  const fallback =
    field.type === 'textarea' ? PLUTO_FORM_MAX_TEXTAREA : PLUTO_FORM_MAX_TEXT
  return Math.min(field.maxLength ?? fallback, fallback)
}

function matches(pattern: string, value: string): boolean {
  try {
    return new RegExp(`^(?:${pattern})$`, 'u').test(value)
  } catch {
    return true
  }
}

function isDate(value: string): boolean {
  if (!DATE.test(value)) {
    return false
  }
  const date = new Date(`${value}T00:00:00Z`)
  return (
    !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
  )
}

function isUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

function checkText(field: PlutoFormField, value: string): string | undefined {
  if (value.length > limitOf(field)) {
    return 'tooLong'
  }
  if (field.minLength !== undefined && value.length < field.minLength) {
    return 'tooShort'
  }
  if (field.pattern && !matches(field.pattern, value)) {
    return 'invalid'
  }
  return undefined
}

function checkField(
  field: PlutoFormField,
  raw: unknown,
  options: PlutoFormValidateOptions
): { value: unknown; error?: string } {
  const type = field.type

  if (type === 'checkbox' || type === 'consent') {
    if (raw !== undefined && typeof raw !== 'boolean' && typeof raw !== 'string') {
      return { value: false, error: 'invalid' }
    }
    const checked = TRUE_VALUES.has(raw as string | boolean)
    return {
      value: checked,
      error: field.required && !checked ? 'required' : undefined,
    }
  }

  if (type === 'hidden') {
    const value = isEmpty(raw) ? (field.value ?? '') : raw
    if (typeof value !== 'string') {
      return { value: '', error: 'invalid' }
    }
    return {
      value,
      error: value.length > PLUTO_FORM_MAX_TEXT ? 'tooLong' : undefined,
    }
  }

  if (isEmpty(raw)) {
    return { value: '', error: field.required ? 'required' : undefined }
  }

  if (typeof raw !== 'string' && typeof raw !== 'number') {
    return { value: '', error: 'invalid' }
  }
  const value = typeof raw === 'string' ? raw.trim() : String(raw)

  if (type === 'number') {
    const number = Number(value)
    if (!Number.isFinite(number) || value.length > 40) {
      return { value, error: 'invalid' }
    }
    if (field.min !== undefined && number < field.min) {
      return { value, error: 'tooSmall' }
    }
    if (field.max !== undefined && number > field.max) {
      return { value, error: 'tooBig' }
    }
    return { value: number }
  }

  if (type === 'select' || type === 'radio') {
    const allowed = (field.options ?? []).some(
      (option) => option.value === value
    )
    return { value, error: allowed ? undefined : 'option' }
  }

  const textError = checkText(field, value)
  if (textError) {
    return { value, error: textError }
  }

  if (type === 'email' && (value.length > 254 || !EMAIL.test(value))) {
    return { value, error: 'invalid' }
  }
  if (type === 'url' && !isUrl(value)) {
    return { value, error: 'invalid' }
  }
  if (type === 'tel' && (!TEL.test(value) || !/\d{3}/.test(value))) {
    return { value, error: 'invalid' }
  }
  if (type === 'date' && !isDate(value)) {
    return { value, error: 'invalid' }
  }

  const custom = options.custom?.[type]
  if (custom) {
    return { value, error: custom(value, field) }
  }
  return { value }
}

/**
 * Checks the values of a form against its fields. The server and the browser use it, so the
 * browser tells the visitor what the server would refuse. A key that is not a field is an
 * error (`unknown`). Each value is a text, a number or a boolean: a list or an object is
 * `invalid`.
 * @see https://pluto.vulmix.dev/docs/build/forms
 */
export function plutoValidateForm(
  fields: PlutoFormField[],
  input: unknown,
  options: PlutoFormValidateOptions = {}
): PlutoFormValidation {
  const errors: PlutoFormErrors = {}
  const values: PlutoFormValues = {}

  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return { values, errors: { _form: 'invalid' } }
  }

  const source = input as Record<string, unknown>
  const names = new Set(fields.map((field) => field.name))

  for (const key of Object.keys(source)) {
    if (!names.has(key)) {
      errors[key] = 'unknown'
    }
  }

  for (const field of fields) {
    const raw = Object.hasOwn(source, field.name)
      ? source[field.name]
      : undefined
    const result = checkField(field, raw, options)
    if (result.error) {
      errors[field.name] = result.error
    } else {
      values[field.name] = result.value
    }
  }

  return { values: Object.keys(errors).length > 0 ? {} : values, errors }
}

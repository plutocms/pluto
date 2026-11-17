import type { PlutoFormField } from '../types/forms'
import { PLUTO_FORM_ERROR_CODES } from './forms-validate'

export interface PlutoFormErrorMessage {
  /** The translation key of the message. Empty when `code` is a text from a custom validator. */
  key: string
  params: { label: string; min: number | string; max: number | string }
}

/**
 * The translation key and the values for the error code of a field. A code that is not in the
 * list (the text of a custom validator) has no key: show the code as it is.
 */
export function plutoFormErrorMessage(
  field: PlutoFormField | undefined,
  code: string
): PlutoFormErrorMessage {
  const known = (PLUTO_FORM_ERROR_CODES as readonly string[]).includes(code)
  return {
    key: known ? `forms.errors.${code}` : '',
    params: {
      label: field?.label || field?.name || '',
      min: field?.minLength ?? field?.min ?? '',
      max: field?.max ?? field?.maxLength ?? '',
    },
  }
}

/** Where a visitor is sent after a submission: a path of the site, or an http(s) URL. Else nothing. */
export function plutoFormRedirect(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined
  }
  const target = value.trim()
  if (target.startsWith('/') && !target.startsWith('//') && !target.includes('\\')) {
    return target
  }
  try {
    const url = new URL(target)
    return url.protocol === 'https:' || url.protocol === 'http:'
      ? url.href
      : undefined
  } catch {
    return undefined
  }
}

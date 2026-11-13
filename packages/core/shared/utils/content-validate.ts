import type { PlutoContentType } from '../types/content'

/** Why a field failed. Each code has a `pluto.validation.<code>` message key. */
export type ContentValidationCode =
  | 'required'
  | 'number'
  | 'integer'
  | 'min'
  | 'max'
  | 'boolean'
  | 'option'
  | 'maxLength'
  | 'reference'

export interface ContentValidationError {
  field: string
  /** English text. It never changes with the admin language. */
  message: string
  /** Machine-readable reason. The admin form uses it to show a translated message. */
  code?: ContentValidationCode
  /** Values for the translated message, for example `{ min: 1 }`. */
  params?: Record<string, unknown>
}

/**
 * Checks a field-keyed payload against the field rules of a content type. It returns the errors.
 *
 * Pass `{ partial: true }` for a partial update: a required field that is missing from `payload`
 * is not an error. A required field with an empty value is an error either way.
 * @see https://pluto.vulmix.dev/docs/reference/content-model#validate-a-payload
 */
export function validateContentPayload(
  type: PlutoContentType,
  payload: Record<string, unknown>,
  options?: {
    partial?: boolean
  }
): ContentValidationError[] {
  const errors: ContentValidationError[] = []

  for (const field of type.fields) {
    const present = Object.hasOwn(payload, field.name)
    const value = payload[field.name]

    if (field.required) {
      const skipBecausePartial = options?.partial === true && !present
      const empty =
        value === undefined ||
        value === null ||
        value === '' ||
        ((field.type === 'reference' || field.type === 'media') &&
          Array.isArray(value) &&
          value.length === 0)
      if (!skipBecausePartial && empty) {
        errors.push({
          field: field.name,
          message: `"${field.label}" is required.`,
          code: 'required',
        })
        continue
      }
    }

    if (!present || value === undefined || value === null) {
      continue
    }

    switch (field.type) {
      case 'number': {
        const numeric = typeof value === 'number' ? value : Number(value)
        if (
          (typeof value !== 'number' && typeof value !== 'string') ||
          Number.isNaN(numeric)
        ) {
          errors.push({
            field: field.name,
            message: `"${field.label}" must be a number.`,
            code: 'number',
          })
          break
        }
        if (field.integer && !Number.isInteger(numeric)) {
          errors.push({
            field: field.name,
            message: `"${field.label}" must be an integer.`,
            code: 'integer',
          })
        }
        if (field.min !== undefined && numeric < field.min) {
          errors.push({
            field: field.name,
            message: `"${field.label}" must be at least ${field.min}.`,
            code: 'min',
            params: { min: field.min },
          })
        }
        if (field.max !== undefined && numeric > field.max) {
          errors.push({
            field: field.name,
            message: `"${field.label}" must be at most ${field.max}.`,
            code: 'max',
            params: { max: field.max },
          })
        }
        break
      }

      case 'boolean': {
        if (typeof value !== 'boolean') {
          errors.push({
            field: field.name,
            message: `"${field.label}" must be a boolean.`,
            code: 'boolean',
          })
        }
        break
      }

      case 'select': {
        if (!field.options.some((option) => option.value === value)) {
          errors.push({
            field: field.name,
            message: `"${field.label}" must be one of the allowed options.`,
            code: 'option',
          })
        }
        break
      }

      case 'text':
      case 'textarea':
      case 'richtext':
      case 'slug': {
        const maxLength = 'maxLength' in field ? field.maxLength : undefined
        if (
          maxLength !== undefined &&
          typeof value === 'string' &&
          value.length > maxLength
        ) {
          errors.push({
            field: field.name,
            message: `"${field.label}" must be at most ${maxLength} characters.`,
            code: 'maxLength',
            params: { max: maxLength },
          })
        }
        break
      }

      case 'reference': {
        const valid = (entry: unknown) =>
          (typeof entry === 'string' && entry !== '') ||
          (typeof entry === 'number' && Number.isFinite(entry))
        const ok =
          value === '' ||
          (field.multiple
            ? Array.isArray(value) && value.every(valid)
            : valid(value))
        if (!ok) {
          errors.push({
            field: field.name,
            message: `"${field.label}" must be an id or a list of ids.`,
            code: 'reference',
          })
        }
        break
      }

      default:
        break
    }
  }

  return errors
}

import type { PlutoContentType } from '../types/content'

/** Why a field failed. Each code has a `pluto.validation.<code>` message key. */
export type ContentValidationCode = 'required' | 'number' | 'integer' | 'min' | 'max' | 'boolean' | 'option' | 'maxLength'

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
 * Checks a field-keyed payload against a content type's field rules. Pure
 * TypeScript, no I/O and no Nuxt/Vue dependency, so a server route (a later
 * wave) and an app composable can both call it and get the same answer.
 *
 * Pass `{ partial: true }` for a partial update (for example a PATCH):
 * a required field missing from `payload` entirely is not an error, because
 * omitting a field is not the same as clearing it. A required field present
 * in `payload` with an empty value is still an error, partial or not.
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
      const empty = value === undefined || value === null || value === ''
      if (!skipBecausePartial && empty) {
        errors.push({ field: field.name, message: `"${field.label}" is required.`, code: 'required' })
        continue
      }
    }

    // Nothing more to check when the field was not supplied at all.
    if (!present || value === undefined || value === null) {
      continue
    }

    switch (field.type) {
      case 'number': {
        const numeric = typeof value === 'number' ? value : Number(value)
        if ((typeof value !== 'number' && typeof value !== 'string') || Number.isNaN(numeric)) {
          errors.push({ field: field.name, message: `"${field.label}" must be a number.`, code: 'number' })
          break
        }
        if (field.integer && !Number.isInteger(numeric)) {
          errors.push({ field: field.name, message: `"${field.label}" must be an integer.`, code: 'integer' })
        }
        if (field.min !== undefined && numeric < field.min) {
          errors.push({ field: field.name, message: `"${field.label}" must be at least ${field.min}.`, code: 'min', params: { min: field.min } })
        }
        if (field.max !== undefined && numeric > field.max) {
          errors.push({ field: field.name, message: `"${field.label}" must be at most ${field.max}.`, code: 'max', params: { max: field.max } })
        }
        break
      }

      case 'boolean': {
        if (typeof value !== 'boolean') {
          errors.push({ field: field.name, message: `"${field.label}" must be a boolean.`, code: 'boolean' })
        }
        break
      }

      case 'select': {
        if (!field.options.some((option) => option.value === value)) {
          errors.push({ field: field.name, message: `"${field.label}" must be one of the allowed options.`, code: 'option' })
        }
        break
      }

      case 'text':
      case 'textarea':
      case 'richtext':
      case 'slug': {
        // Only PlutoTextField carries maxLength; PlutoSlugField never does,
        // so the 'in' check both narrows the type and skips slug fields.
        const maxLength = 'maxLength' in field ? field.maxLength : undefined
        if (maxLength !== undefined && typeof value === 'string' && value.length > maxLength) {
          errors.push({
            field: field.name,
            message: `"${field.label}" must be at most ${maxLength} characters.`,
            code: 'maxLength',
            params: { max: maxLength },
          })
        }
        break
      }

      // 'date' | 'reference' | 'media': no format check in this wave, only
      // the required check above.
      default:
        break
    }
  }

  return errors
}

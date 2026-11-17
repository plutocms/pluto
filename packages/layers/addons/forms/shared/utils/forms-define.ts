import type {
  PlutoFormDefinition,
  PlutoFormFieldTypeInput,
  PlutoFormInput,
  PlutoFormSettings,
  PlutoPublicForm,
} from '../types/forms'
import type { PlutoFormValidateOptions } from './forms-validate'
import { PLUTO_FORM_DEFAULT_SUBMIT_LABEL } from './forms-fields'

export const PLUTO_FORM_HANDLE = /^[a-z0-9][a-z0-9-]{0,59}$/

export const PLUTO_FORM_DEFAULT_RETENTION_DAYS = 180

export const PLUTO_FORM_MAX_RECIPIENTS = 10

export const PLUTO_FORM_DEFAULT_SUCCESS = 'Thank you. We got your message.'

const RECIPIENT = /^[^\s@<>,;:"()[\]\\]+@[^\s"(),:;<>@[\\\]][^\s"(),.:;<>@[\\\]]*\.[^\s"(),:;<>@[\\\]]{2,}$/

/**
 * Reads the addresses of a list: one text with commas, semicolons or new lines, or an array.
 * It keeps the valid addresses only, once each, up to ten.
 */
export function plutoFormRecipients(value: unknown): string[] {
  const parts = Array.isArray(value)
    ? value.map((part) => String(part))
    : typeof value === 'string'
      ? value.split(/[\s,;]+/)
      : []
  const found = new Map<string, string>()
  for (const part of parts) {
    const address = part.trim()
    if (RECIPIENT.test(address) && address.length <= 254) {
      found.set(address.toLowerCase(), address)
    }
  }
  return [...found.values()].slice(0, PLUTO_FORM_MAX_RECIPIENTS)
}

function retention(value: unknown, fallback: number): number {
  const number =
    typeof value === 'number' || (typeof value === 'string' && value !== '')
      ? Number(value)
      : Number.NaN
  return Number.isFinite(number)
    ? Math.min(3650, Math.max(0, Math.trunc(number)))
    : fallback
}

function line(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

/**
 * The settings of a form, from raw values: the fields of a `form` item, or the `settings` of a
 * code form. A bad value falls back to `base`, or to the default.
 */
export function plutoFormSettings(
  raw: Record<string, unknown> | null | undefined,
  base?: Partial<PlutoFormSettings>
): PlutoFormSettings {
  const recipients =
    raw?.recipients !== undefined &&
    plutoFormRecipients(raw.recipients).length > 0
      ? plutoFormRecipients(raw.recipients)
      : plutoFormRecipients(base?.recipients ?? [])
  const subject = line(raw?.subject) ?? base?.subject
  const successMessage = line(raw?.successMessage) ?? base?.successMessage
  const redirect = line(raw?.redirect) ?? base?.redirect
  return {
    recipients,
    ...(subject && { subject }),
    ...(successMessage && { successMessage }),
    ...(redirect && { redirect }),
    retentionDays: retention(
      raw?.retentionDays,
      base?.retentionDays ?? PLUTO_FORM_DEFAULT_RETENTION_DAYS
    ),
  }
}

/**
 * Defines a form in code. Put it in the `forms` list of `plutoForms` in `app.config.ts`, in the
 * app or in a layer. The structure (the fields) is read-only in the admin. A `form` item of the
 * admin with the same handle can change the texts and the settings.
 * @example
 * export default defineAppConfig({
 *   plutoForms: {
 *     forms: [
 *       definePlutoForm({
 *         handle: 'newsletter',
 *         title: 'Newsletter',
 *         fields: [{ name: 'email', type: 'email', label: 'Email', required: true }],
 *         settings: { recipients: ['team@example.com'] },
 *       }),
 *     ],
 *   },
 * })
 * @see https://pluto.vulmix.dev/docs/build/forms
 */
export function definePlutoForm(input: PlutoFormInput): PlutoFormDefinition {
  if (!PLUTO_FORM_HANDLE.test(input.handle)) {
    throw new Error(
      `[pluto-forms] The handle "${input.handle}" is not valid. Use lower case letters, digits and "-".`
    )
  }
  return {
    handle: input.handle,
    title: input.title,
    fields: input.fields,
    submitLabel: input.submitLabel || PLUTO_FORM_DEFAULT_SUBMIT_LABEL,
    settings: plutoFormSettings(
      (input.settings ?? null) as Record<string, unknown> | null
    ),
    source: 'code',
  }
}

/**
 * Defines a custom field type. Put it in the `fieldTypes` list of `plutoForms` in `app.config.ts`.
 * The `block` is a content component of the site (with `definePlutoBlock`) that an editor adds to
 * a form. `validate` runs on the server and in the browser.
 * @see https://pluto.vulmix.dev/docs/build/forms
 */
export function definePlutoFormField(
  input: PlutoFormFieldTypeInput
): PlutoFormFieldTypeInput {
  return input
}

/**
 * Joins a code form and the `form` item of the admin that has the same handle. The code decides
 * the structure. The item changes the title and the settings that it sets.
 */
export function plutoMergeForm(
  code: PlutoFormDefinition,
  item: Record<string, unknown> | null | undefined
): PlutoFormDefinition {
  if (!item) {
    return code
  }
  return {
    ...code,
    title: line(item.title) ?? code.title,
    settings: plutoFormSettings(item, code.settings),
  }
}

/** The part of a form that a browser may see. */
export function plutoPublicForm(form: PlutoFormDefinition): PlutoPublicForm {
  return {
    handle: form.handle,
    title: form.title,
    fields: form.fields,
    submitLabel: form.submitLabel,
    successMessage:
      form.settings.successMessage ?? PLUTO_FORM_DEFAULT_SUCCESS,
  }
}

/** The custom field blocks, as `{ block: typeName }`, and the validators by type name. */
export function plutoFormCustomTypes(types: PlutoFormFieldTypeInput[] = []): {
  blocks: Record<string, string>
  validators: NonNullable<PlutoFormValidateOptions['custom']>
} {
  const blocks: Record<string, string> = {}
  const validators: NonNullable<PlutoFormValidateOptions['custom']> = {}
  for (const type of types) {
    blocks[type.block] = type.name
    validators[type.name] = type.validate
  }
  return { blocks, validators }
}

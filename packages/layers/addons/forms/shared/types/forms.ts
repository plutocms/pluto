/**
 * One field of a form. The same shape comes from the field blocks of a form, and from a form
 * defined in code. `type` is an input type (`text`, `email`, `tel`, `url`, `number`, `date`), one
 * of `textarea`, `select`, `radio`, `checkbox`, `consent`, `hidden`, or the name of a custom field
 * type (`definePlutoFormField`).
 * @see https://pluto.vulmix.dev/docs/build/forms
 */
export interface PlutoFormField {
  name: string
  type: string
  label: string
  placeholder?: string
  help?: string
  required?: boolean
  /** `half` puts two fields in one row. Default `full`. */
  width?: 'full' | 'half'
  options?: PlutoFormOption[]
  min?: number
  max?: number
  minLength?: number
  maxLength?: number
  /** A regular expression, without the slashes. The value must match all of it. */
  pattern?: string
  /** The value of a `hidden` field. */
  value?: string
  /** `consent`: the page of the privacy policy. */
  link?: string
  /** `textarea`: the height in rows. */
  rows?: number
  /** The other props of a custom field block. */
  props?: Record<string, unknown>
}

export interface PlutoFormOption {
  value: string
  label: string
}

/** The settings of a form. They never reach the public API. */
export interface PlutoFormSettings {
  /** The addresses that get an email for each submission. */
  recipients: string[]
  /** The subject of the email. */
  subject?: string
  /** The message that the visitor sees after a submission. */
  successMessage?: string
  /** A path or URL that the form opens after a submission. */
  redirect?: string
  /** Submissions older than this many days are deleted every day. 0 keeps them for ever. */
  retentionDays: number
}

/** A form with its settings. The server uses it. Never send it to a browser. */
export interface PlutoFormDefinition {
  handle: string
  title: string
  fields: PlutoFormField[]
  submitLabel: string
  settings: PlutoFormSettings
  /** Where the structure of the form lives. A `code` form has a read-only structure in the admin. */
  source: 'content' | 'code'
}

/** What the public routes and the browser see of a form. It holds no setting but the success message. */
export interface PlutoPublicForm {
  handle: string
  title: string
  fields: PlutoFormField[]
  submitLabel: string
  successMessage: string
}

/** The input of `definePlutoForm`. */
export interface PlutoFormInput {
  handle: string
  title: string
  fields: PlutoFormField[]
  submitLabel?: string
  settings?: Partial<PlutoFormSettings>
}

/** The input of `definePlutoFormField`. */
export interface PlutoFormFieldTypeInput {
  /** The `type` of the fields that use it. */
  name: string
  /** The name of the content component (the block) that an editor adds to a form, for example `form-rating`. */
  block: string
  /** Returns an error text for a bad value, or nothing. It runs on the server and in the browser. */
  validate?: (value: unknown, field: PlutoFormField) => string | undefined
  /**
   * The name of the component that draws the field, for example `MyRatingField`. Put the file in
   * `components/global/`, so the form finds it by name. It gets `field`, `modelValue`, `error`,
   * `id` and `disabled`, and it emits `update:modelValue`. Without it, the field is a text input.
   */
  component?: string
}

export type PlutoFormValues = Record<string, unknown>

export type PlutoFormErrors = Record<string, string>

export interface PlutoFormSubmission {
  id: string
  form: string
  createdAt: string
  values: PlutoFormValues
}

export interface PlutoFormSubmissionInput {
  form: string
  values: PlutoFormValues
  createdAt?: string
}

export interface PlutoFormSubmissionPage {
  data: PlutoFormSubmission[]
  total: number
}

/**
 * Where the submissions live. A backend layer registers one with `registerFormStore`. Without
 * one, the layer uses a Nitro storage mount (`plutoForms.storage`).
 * @see https://pluto.vulmix.dev/docs/build/forms
 */
export interface PlutoFormStore {
  id: string
  add: (input: PlutoFormSubmissionInput) => Promise<PlutoFormSubmission>
  /** The newest first. */
  list: (
    form: string,
    query: { limit: number; offset: number }
  ) => Promise<PlutoFormSubmissionPage>
  get: (form: string, id: string) => Promise<PlutoFormSubmission | null>
  delete: (form: string, id: string) => Promise<void>
  /** Deletes the submissions created before the date. Returns how many. */
  purge: (form: string, olderThan: Date) => Promise<number>
}

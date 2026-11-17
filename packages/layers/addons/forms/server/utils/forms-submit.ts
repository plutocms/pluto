import type {
  PlutoFormDefinition,
  PlutoFormErrors,
  PlutoFormStore,
  PlutoFormSubmission,
  PlutoFormValues,
} from '../../shared/types/forms'
import type { PlutoFormValidateOptions } from '../../shared/utils/forms-validate'
import type { PlutoFormsConfig } from './forms-config'
import type { PlutoFormsRateLimiter } from './forms-spam'
import { Buffer } from 'node:buffer'
import { renderFormsEmail } from './forms-mail'
import { checkFormsSpam } from './forms-spam'

export type PlutoFormsAnswerCode =
  | 'not-found'
  | 'no-store'
  | 'no-secret'
  | 'bad-request'
  | 'too-large'
  | 'rate-limit'
  | 'token'
  | 'turnstile'
  | 'invalid'
  | 'rejected'
  | 'error'

export interface PlutoFormsAnswer {
  status: number
  body: {
    ok: boolean
    message?: string
    code?: PlutoFormsAnswerCode
    redirect?: string
    errors?: PlutoFormErrors
  }
  headers?: Record<string, string>
}

/** What a `pluto:forms:before-store` and a `pluto:forms:submission` hook gets. */
export interface PlutoFormsHookContext {
  form: { handle: string; title: string }
  /** The clean values. A hook cannot change what the server stores. */
  values: Readonly<PlutoFormValues>
  ip: string
  /** `pluto:forms:submission` only: the stored submission. */
  submission?: PlutoFormSubmission
  /** `pluto:forms:before-store` only: refuses the submission. The visitor sees the message. */
  reject: (message: string) => never
}

export class PlutoFormsRejection extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PlutoFormsRejection'
  }
}

export interface PlutoFormsSubmitDeps {
  config: PlutoFormsConfig
  limiter: PlutoFormsRateLimiter
  store: PlutoFormStore | null
  loadForm: (handle: string) => Promise<PlutoFormDefinition | null>
  sendMail: (message: {
    to: string[]
    subject: string
    html: string
    text: string
    replyTo?: string
  }) => Promise<unknown>
  beforeStore: (context: PlutoFormsHookContext) => Promise<void>
  afterStore: (context: PlutoFormsHookContext) => Promise<void>
  validate?: PlutoFormValidateOptions
  siteName?: string
  now?: () => number
  fetch?: typeof fetch
}

export interface PlutoFormsSubmitInput {
  handle: string
  ip: string
  /** The raw request body (a text or an object). */
  body: unknown
}

function fail(
  status: number,
  code: PlutoFormsAnswerCode,
  message: string,
  extra: Partial<PlutoFormsAnswer> & { errors?: PlutoFormErrors } = {}
): PlutoFormsAnswer {
  const { errors, headers } = extra
  return {
    status,
    body: { ok: false, code, message, ...(errors && { errors }) },
    ...(headers && { headers }),
  }
}

function parseBody(
  body: unknown
): { body: Record<string, unknown> } | { error: 'too-large' | 'bad-request' } {
  let value = body
  if (typeof body === 'string') {
    if (Buffer.byteLength(body) > PLUTO_FORM_MAX_BODY_BYTES) {
      return { error: 'too-large' }
    }
    try {
      value = JSON.parse(body)
    } catch {
      return { error: 'bad-request' }
    }
  }
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? { body: value as Record<string, unknown> }
    : { error: 'bad-request' }
}

const SPAM_ANSWERS = {
  'invalid-token': [
    400,
    'token',
    'The form could not be checked. Reload the page and try again.',
  ],
  'too-fast': [400, 'token', 'That was fast. Wait a moment and send again.'],
  'expired': [
    400,
    'token',
    'The form expired. Reload the page and try again.',
  ],
  'turnstile': [
    400,
    'turnstile',
    'The check against robots failed. Try again.',
  ],
} as const

/**
 * Handles one submission, with no framework: it checks the spam rules, validates the values,
 * runs the hooks, stores the submission and sends the email. The route passes the real parts.
 * A failed email does not fail the submission: it is stored, and the log tells.
 * @see https://pluto.vulmix.dev/docs/build/forms
 */
export async function submitPlutoForm(
  deps: PlutoFormsSubmitDeps,
  input: PlutoFormsSubmitInput
): Promise<PlutoFormsAnswer> {
  const { config } = deps

  if (!deps.store) {
    return fail(
      503,
      'no-store',
      'This form cannot take submissions yet: the site has no place to keep them.'
    )
  }
  if (!config.secret) {
    return fail(
      503,
      'no-secret',
      'This form cannot take submissions yet: the site has no signing secret.'
    )
  }

  const parsed = parseBody(input.body)
  if ('error' in parsed) {
    return parsed.error === 'too-large'
      ? fail(413, 'too-large', 'The request is too large.')
      : fail(400, 'bad-request', 'The request is not valid.')
  }
  const { body } = parsed

  const spam = await checkFormsSpam(
    {
      handle: input.handle,
      ip: input.ip,
      honeypot: body.hp,
      token: body.token,
      turnstileToken: body.turnstile,
    },
    {
      secret: config.secret,
      limiter: deps.limiter,
      minFillMs: config.minFillMs,
      now: deps.now?.(),
      turnstileSecret: config.turnstileSecret || undefined,
      fetch: deps.fetch,
    }
  )
  if (!spam.ok) {
    if (spam.reason === 'honeypot') {
      return { status: 200, body: { ok: true, message: 'Thank you.' } }
    }
    if (spam.reason === 'rate-limit') {
      return fail(
        429,
        'rate-limit',
        'Too many submissions. Try again in a moment.',
        { headers: { 'Retry-After': String(spam.retryAfter ?? 60) } }
      )
    }
    const [status, code, message] = SPAM_ANSWERS[spam.reason]
    return fail(status, code, message)
  }

  const form = await deps.loadForm(input.handle)
  if (!form) {
    return fail(404, 'not-found', 'This form does not exist.')
  }

  const { values, errors } = plutoValidateForm(
    form.fields,
    body.values,
    deps.validate
  )
  if (Object.keys(errors).length > 0) {
    return fail(422, 'invalid', 'Some fields need your attention.', { errors })
  }

  const context: PlutoFormsHookContext = {
    form: { handle: form.handle, title: form.title },
    values: Object.freeze({ ...values }),
    ip: input.ip,
    reject: (message) => {
      throw new PlutoFormsRejection(message)
    },
  }

  try {
    await deps.beforeStore(context)
  } catch (error) {
    if (error instanceof PlutoFormsRejection) {
      return fail(422, 'rejected', error.message)
    }
    console.error('[pluto-forms] A before-store hook failed.', error)
    return fail(500, 'error', 'The form could not be sent. Try again later.')
  }

  let submission: PlutoFormSubmission
  try {
    submission = await deps.store.add({ form: form.handle, values })
  } catch (error) {
    console.error('[pluto-forms] The store did not keep a submission.', error)
    return fail(500, 'error', 'The form could not be sent. Try again later.')
  }

  if (form.settings.recipients.length > 0) {
    try {
      const email = renderFormsEmail({
        form,
        values,
        siteName: deps.siteName,
        createdAt: submission.createdAt,
      })
      await deps.sendMail({
        to: form.settings.recipients,
        subject: email.subject,
        html: email.html,
        text: email.text,
        ...(email.replyTo && { replyTo: email.replyTo }),
      })
    } catch (error) {
      console.warn(
        `[pluto-forms] The email of a submission of "${form.handle}" was not sent: ${(error as Error).message}`
      )
    }
  }

  try {
    await deps.afterStore({ ...context, submission })
  } catch (error) {
    console.warn(
      `[pluto-forms] A submission hook failed for "${form.handle}": ${(error as Error).message}`
    )
  }

  return {
    status: 200,
    body: {
      ok: true,
      message: form.settings.successMessage ?? PLUTO_FORM_DEFAULT_SUCCESS,
      ...(form.settings.redirect && { redirect: form.settings.redirect }),
    },
  }
}

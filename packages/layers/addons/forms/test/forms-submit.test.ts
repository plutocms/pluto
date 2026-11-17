import type { PlutoFormsSubmitDeps } from '../server/utils/forms-submit'
import type { PlutoFormDefinition } from '../shared/types/forms'
import { createStorage } from 'unstorage'
import memory from 'unstorage/drivers/memory'
import { describe, expect, it, vi } from 'vitest'
import { readFormsConfig } from '../server/utils/forms-config'
import { createFormsRateLimiter } from '../server/utils/forms-spam'
import { createStorageFormStore } from '../server/utils/forms-store'
import { submitPlutoForm } from '../server/utils/forms-submit'
import { signFormsToken } from '../server/utils/forms-token'

const SECRET = 'a-long-secret-for-the-tests'

const BASE = 1_700_000_000_000

const form: PlutoFormDefinition = {
  handle: 'contact',
  title: 'Contact',
  submitLabel: 'Send',
  source: 'content',
  fields: [
    { name: 'name', type: 'text', label: 'Name', required: true },
    { name: 'email', type: 'email', label: 'Email', required: true },
    { name: 'message', type: 'textarea', label: 'Message' },
  ],
  settings: {
    recipients: ['team@example.com'],
    subject: 'Hello from the site',
    successMessage: 'Thanks!',
    retentionDays: 180,
  },
}

function setup(extra: Partial<PlutoFormsSubmitDeps> = {}) {
  const store = createStorageFormStore(createStorage({ driver: memory() }))
  const sendMail = vi.fn(async () => ({}))
  const beforeStore = vi.fn(async () => {})
  const afterStore = vi.fn(async () => {})
  const deps: PlutoFormsSubmitDeps = {
    config: {
      ...readFormsConfig({ secret: SECRET }, { dev: false }),
      minFillMs: 3000,
    },
    limiter: createFormsRateLimiter({ limit: 5, windowMs: 60_000 }),
    store,
    loadForm: async (handle) => (handle === 'contact' ? form : null),
    sendMail,
    beforeStore,
    afterStore,
    now: () => BASE + 10_000,
    ...extra,
  }
  return { deps, store, sendMail, beforeStore, afterStore }
}

function body(extra: Record<string, unknown> = {}, values: unknown = {}) {
  return JSON.stringify({
    values: { name: 'Ana', email: 'ana@example.com', message: 'Hi', ...(values as object) },
    token: signFormsToken(SECRET, 'contact', BASE),
    hp: '',
    ...extra,
  })
}

const input = (raw: unknown, handle = 'contact') => ({
  handle,
  ip: '203.0.113.9',
  body: raw,
})

describe('submitPlutoForm', () => {
  it('stores, sends the email, runs the hooks and answers 200', async () => {
    const { deps, store, sendMail, beforeStore, afterStore } = setup()

    const answer = await submitPlutoForm(deps, input(body()))

    expect(answer).toEqual({
      status: 200,
      body: { ok: true, message: 'Thanks!' },
    })
    const list = await store.list('contact', { limit: 10, offset: 0 })
    expect(list.data[0]?.values).toEqual({
      name: 'Ana',
      email: 'ana@example.com',
      message: 'Hi',
    })
    expect(sendMail).toHaveBeenCalledOnce()
    expect(beforeStore).toHaveBeenCalledOnce()
    expect(afterStore).toHaveBeenCalledOnce()
    expect(afterStore.mock.calls[0]?.[0]).toMatchObject({
      form: { handle: 'contact' },
      submission: { form: 'contact' },
    })
  })

  it('sends the email with a safe reply-to and the settings of the form', async () => {
    const { deps, sendMail } = setup()

    await submitPlutoForm(deps, input(body()))

    expect(sendMail.mock.calls[0]?.[0]).toMatchObject({
      to: ['team@example.com'],
      subject: 'Hello from the site',
      replyTo: 'ana@example.com',
    })
  })

  it('refuses a header injection in the email field', async () => {
    const { deps, store, sendMail } = setup()

    const answer = await submitPlutoForm(
      deps,
      input(body({}, { email: 'a@b.com\r\nBcc: spy@evil.com' }))
    )

    expect(answer.status).toBe(422)
    expect(answer.body.errors).toEqual({ email: 'invalid' })
    expect(sendMail).not.toHaveBeenCalled()
    expect((await store.list('contact', { limit: 10, offset: 0 })).total).toBe(0)
  })

  it('answers 422 with the field errors', async () => {
    const { deps, store, beforeStore } = setup()

    const answer = await submitPlutoForm(deps, input(body({}, { name: '', email: 'x' })))

    expect(answer.status).toBe(422)
    expect(answer.body).toMatchObject({
      ok: false,
      code: 'invalid',
      errors: { name: 'required', email: 'invalid' },
    })
    expect(beforeStore).not.toHaveBeenCalled()
    expect((await store.list('contact', { limit: 10, offset: 0 })).total).toBe(0)
  })

  it('refuses a key that is not a field', async () => {
    const { deps } = setup()

    const answer = await submitPlutoForm(deps, input(body({}, { admin: 'yes' })))

    expect(answer.status).toBe(422)
    expect(answer.body.errors).toEqual({ admin: 'unknown' })
  })

  it('answers 503 when the site has no store, and does nothing', async () => {
    const { deps, sendMail, beforeStore } = setup({ store: null })

    const answer = await submitPlutoForm(deps, input(body()))

    expect(answer.status).toBe(503)
    expect(answer.body).toMatchObject({ ok: false, code: 'no-store' })
    expect(sendMail).not.toHaveBeenCalled()
    expect(beforeStore).not.toHaveBeenCalled()
  })

  it('answers 503 when the site has no signing secret', async () => {
    const { deps } = setup({
      config: readFormsConfig({}, { dev: false }),
    })

    expect((await submitPlutoForm(deps, input(body()))).body.code).toBe('no-secret')
  })

  it('answers 404 for a form that does not exist', async () => {
    const { deps } = setup()

    const answer = await submitPlutoForm(deps, input(body({ token: signFormsToken(SECRET, 'nope', BASE) }), 'nope'))

    expect(answer.status).toBe(404)
  })

  it('answers 400 for a body that is not JSON, and 413 for a big one', async () => {
    const { deps } = setup()

    expect((await submitPlutoForm(deps, input('not json'))).status).toBe(400)
    expect((await submitPlutoForm(deps, input('[]'))).status).toBe(400)
    expect((await submitPlutoForm(deps, input(' '.repeat(70_000)))).status).toBe(413)
  })

  it('says ok for the honeypot but stores nothing', async () => {
    const { deps, store, sendMail } = setup()

    const answer = await submitPlutoForm(deps, input(body({ hp: 'http://spam.example' })))

    expect(answer.status).toBe(200)
    expect(answer.body.ok).toBe(true)
    expect(sendMail).not.toHaveBeenCalled()
    expect((await store.list('contact', { limit: 10, offset: 0 })).total).toBe(0)
  })

  it('refuses a form sent too fast and one with a bad token', async () => {
    const fast = setup({ now: () => BASE + 500 })
    const bad = setup()

    expect((await submitPlutoForm(fast.deps, input(body()))).body.code).toBe('token')
    expect((await submitPlutoForm(bad.deps, input(body({ token: 'bad' })))).status).toBe(400)
  })

  it('answers 429 with Retry-After past the rate limit', async () => {
    const { deps } = setup({
      limiter: createFormsRateLimiter({ limit: 1, windowMs: 60_000 }),
    })

    await submitPlutoForm(deps, input(body()))
    const answer = await submitPlutoForm(deps, input(body()))

    expect(answer.status).toBe(429)
    expect(answer.headers?.['Retry-After']).toBeDefined()
  })

  it('refuses a submission when Turnstile says no', async () => {
    const { deps, store } = setup({
      config: {
        ...readFormsConfig({ secret: SECRET, turnstileSecret: 'ts', turnstileSiteKey: 'sk' }, { dev: false }),
        minFillMs: 3000,
      },
      fetch: (async () => Response.json({ success: false })) as typeof fetch,
    })

    const answer = await submitPlutoForm(deps, input(body({ turnstile: 'x' })))

    expect(answer.body.code).toBe('turnstile')
    expect((await store.list('contact', { limit: 10, offset: 0 })).total).toBe(0)
  })

  it('lets a before-store hook reject the submission', async () => {
    const { deps, store, sendMail } = setup({
      beforeStore: async (context) => {
        context.reject('No spam links, please.')
      },
    })

    const answer = await submitPlutoForm(deps, input(body()))

    expect(answer.status).toBe(422)
    expect(answer.body).toMatchObject({ code: 'rejected', message: 'No spam links, please.' })
    expect(sendMail).not.toHaveBeenCalled()
    expect((await store.list('contact', { limit: 10, offset: 0 })).total).toBe(0)
  })

  it('answers 500 when a before-store hook crashes', async () => {
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { deps } = setup({
      beforeStore: async () => {
        throw new Error('boom')
      },
    })

    expect((await submitPlutoForm(deps, input(body()))).status).toBe(500)
    quiet.mockRestore()
  })

  it('keeps the submission when the email fails', async () => {
    const quiet = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { deps, store } = setup({
      sendMail: async () => {
        throw new Error('no driver')
      },
    })

    const answer = await submitPlutoForm(deps, input(body()))

    expect(answer.status).toBe(200)
    expect((await store.list('contact', { limit: 10, offset: 0 })).total).toBe(1)
    quiet.mockRestore()
  })

  it('still answers 200 when the submission hook fails', async () => {
    const quiet = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { deps } = setup({
      afterStore: async () => {
        throw new Error('webhook down')
      },
    })

    expect((await submitPlutoForm(deps, input(body()))).status).toBe(200)
    quiet.mockRestore()
  })

  it('answers 500 when the store fails, with no detail', async () => {
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { deps, store } = setup()
    store.add = async () => {
      throw new Error('secret connection string')
    }

    const answer = await submitPlutoForm(deps, input(body()))

    expect(answer.status).toBe(500)
    expect(JSON.stringify(answer)).not.toContain('secret connection string')
    quiet.mockRestore()
  })

  it('sends no email when the form has no recipients, and gives the redirect', async () => {
    const { deps, sendMail } = setup({
      loadForm: async () => ({
        ...form,
        settings: { ...form.settings, recipients: [], redirect: '/thanks' },
      }),
    })

    const answer = await submitPlutoForm(deps, input(body()))

    expect(sendMail).not.toHaveBeenCalled()
    expect(answer.body.redirect).toBe('/thanks')
  })

  it('gives the hook a copy of the values that it cannot change', async () => {
    let seen: Record<string, unknown> = {}
    const { deps, store } = setup({
      beforeStore: async (context) => {
        seen = context.values as Record<string, unknown>
        expect(() => {
          ;(context.values as Record<string, unknown>).name = 'Hacked'
        }).toThrow()
      },
    })

    await submitPlutoForm(deps, input(body()))

    expect(seen.name).toBe('Ana')
    expect((await store.list('contact', { limit: 10, offset: 0 })).data[0]?.values.name).toBe('Ana')
  })
})

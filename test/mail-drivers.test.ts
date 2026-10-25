import { afterEach, describe, expect, it, vi } from 'vitest'
import { createDevDriver, parseAddress } from '../server/mail/drivers/dev'
import { createNoneDriver } from '../server/mail/drivers/none'
import { createResendDriver, RESEND_TEST_SENDER } from '../server/mail/drivers/resend'
import { PlutoMailError } from '../server/mail/errors'
import { createResendClient, mapResendError, RESEND_USER_AGENT } from '../server/mail/resend-client'

const message = {
  to: 'ana@example.com',
  subject: 'Hello',
  html: '<p>Hi</p>',
  text: 'Hi',
}
const context = { from: 'Shop <hello@example.com>', replyTo: '' }

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

interface Call {
  url: string
  init: RequestInit
}

/** A fake fetch. Each queued item is a Response, or an Error to throw. */
function fakeFetch(...queue: Array<Response | Error | ((init: RequestInit) => Promise<Response>)>) {
  const calls: Call[] = []
  const fetch = vi.fn(async (url: string | URL | Request, init: RequestInit = {}) => {
    calls.push({ url: String(url), init })
    const next = queue.shift()
    if (next === undefined) {
      throw new Error('The fake fetch has no answer left.')
    }
    if (next instanceof Error) {
      throw next
    }
    if (typeof next === 'function') {
      return next(init)
    }
    return next
  }) as unknown as typeof globalThis.fetch
  return { fetch, calls }
}

function headersOf(call: Call): Record<string, string> {
  return call.init.headers as Record<string, string>
}

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('resend driver', () => {
  it('posts the message to /emails with the headers Resend needs', async () => {
    const { fetch, calls } = fakeFetch(json({ id: 'msg_1' }))
    const driver = createResendDriver({ apiKey: 're_key', fetch })

    const result = await driver.send({ ...message, replyTo: 'support@example.com', idempotencyKey: 'key-1' }, context)

    expect(result).toEqual({ id: 'msg_1', driver: 'resend' })
    expect(calls).toHaveLength(1)
    expect(calls[0]!.url).toBe('https://api.resend.com/emails')
    expect(calls[0]!.init.method).toBe('POST')
    expect(headersOf(calls[0]!)).toMatchObject({
      'Authorization': 'Bearer re_key',
      'User-Agent': RESEND_USER_AGENT,
      'Idempotency-Key': 'key-1',
      'Content-Type': 'application/json',
    })
    expect(JSON.parse(String(calls[0]!.init.body))).toEqual({
      from: 'Shop <hello@example.com>',
      to: ['ana@example.com'],
      subject: 'Hello',
      html: '<p>Hi</p>',
      text: 'Hi',
      reply_to: 'support@example.com',
    })
  })

  it('makes an Idempotency-Key when the message has none', async () => {
    const { fetch, calls } = fakeFetch(json({ id: 'a' }), json({ id: 'b' }))
    const driver = createResendDriver({ apiKey: 're_key', fetch })

    await driver.send(message, context)
    await driver.send(message, context)

    const keys = calls.map((call) => headersOf(call)['Idempotency-Key'])
    expect(keys[0]).toMatch(/^[\da-f-]{36}$/)
    expect(keys[0]).not.toBe(keys[1])
  })

  it('uses the test sender when no From address is set', async () => {
    const { fetch, calls } = fakeFetch(json({ id: 'a' }))

    await createResendDriver({ apiKey: 're_key', fetch }).send(message, { from: '', replyTo: '' })

    expect(JSON.parse(String(calls[0]!.init.body)).from).toBe(RESEND_TEST_SENDER)
  })

  it('prefers the From address of the message', async () => {
    const { fetch, calls } = fakeFetch(json({ id: 'a' }))

    await createResendDriver({ apiKey: 're_key', fetch }).send({ ...message, from: 'Other <o@example.com>' }, context)

    expect(JSON.parse(String(calls[0]!.init.body)).from).toBe('Other <o@example.com>')
  })

  it('throws not_configured with no key, and calls nothing', async () => {
    const { fetch, calls } = fakeFetch()
    const driver = createResendDriver({ apiKey: '', fetch })

    await expect(driver.send(message, context)).rejects.toMatchObject({ code: 'not_configured' })
    expect(driver.isConfigured?.()).toBe(false)
    expect(calls).toHaveLength(0)
  })

  describe('retry', () => {
    it('retries once with the same key after a network error', async () => {
      const { fetch, calls } = fakeFetch(new TypeError('fetch failed'), json({ id: 'msg_2' }))

      const result = await createResendDriver({ apiKey: 're_key', fetch }).send({ ...message, idempotencyKey: 'k' }, context)

      expect(result.id).toBe('msg_2')
      expect(calls).toHaveLength(2)
      expect(headersOf(calls[0]!)['Idempotency-Key']).toBe('k')
      expect(headersOf(calls[1]!)['Idempotency-Key']).toBe('k')
    })

    it('retries once after a 5xx', async () => {
      const { fetch, calls } = fakeFetch(json({ name: 'internal_server_error' }, 500), json({ id: 'msg_3' }))

      const result = await createResendDriver({ apiKey: 're_key', fetch }).send(message, context)

      expect(result.id).toBe('msg_3')
      expect(calls).toHaveLength(2)
      expect(headersOf(calls[0]!)['Idempotency-Key']).toBe(headersOf(calls[1]!)['Idempotency-Key'])
    })

    it('stops after one retry', async () => {
      const { fetch, calls } = fakeFetch(json({}, 503), json({}, 502), json({ id: 'never' }))

      await expect(createResendDriver({ apiKey: 're_key', fetch }).send(message, context)).rejects.toMatchObject({
        code: 'provider_error',
        status: 502,
      })
      expect(calls).toHaveLength(2)
    })

    it('does not retry a 4xx', async () => {
      const { fetch, calls } = fakeFetch(json({ name: 'validation_error' }, 422), json({ id: 'never' }))

      await expect(createResendDriver({ apiKey: 're_key', fetch }).send(message, context)).rejects.toMatchObject({
        code: 'invalid_message',
      })
      expect(calls).toHaveLength(1)
    })
  })

  describe('timeout', () => {
    it('aborts an attempt after the timeout, retries, then reports timeout', async () => {
      vi.useFakeTimers()
      const hang = (init: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal!.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
        })
      const { fetch, calls } = fakeFetch(hang, hang)

      const pending = createResendDriver({ apiKey: 're_key', fetch }).send(message, context)
      const assertion = expect(pending).rejects.toMatchObject({ code: 'timeout' })
      await vi.advanceTimersByTimeAsync(4000)
      await vi.advanceTimersByTimeAsync(4000)
      await assertion

      expect(calls).toHaveLength(2)
    })

    it('uses a 4 second timeout by default', async () => {
      vi.useFakeTimers()
      let aborted = false
      const { fetch } = fakeFetch((init) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal!.addEventListener('abort', () => {
            aborted = true
            reject(new DOMException('Aborted', 'AbortError'))
          })
        })
      )

      const pending = createResendClient({ apiKey: 're_key', fetch }).request('GET', '/domains')
      const assertion = expect(pending).rejects.toMatchObject({ code: 'timeout' })
      await vi.advanceTimersByTimeAsync(3999)
      expect(aborted).toBe(false)
      await vi.advanceTimersByTimeAsync(1)
      await assertion

      expect(aborted).toBe(true)
    })
  })

  describe('error mapping', () => {
    const cases: Array<[string, number, Record<string, unknown>, string]> = [
      ['a bad key', 401, { name: 'invalid_api_key', message: 'API key is invalid' }, 'invalid_key'],
      ['a missing key', 401, { name: 'missing_api_key' }, 'invalid_key'],
      ['a send-only key', 401, { name: 'restricted_api_key', message: 'This API key is restricted to only send emails' }, 'restricted_key'],
      ['a send-only key on 403', 403, { name: 'restricted_api_key' }, 'restricted_key'],
      ['the test sender rule', 403, { name: 'validation_error', message: 'You can only send testing emails to your own email address (me@example.com).' }, 'test_sender_only'],
      ['an unverified domain', 403, { name: 'validation_error', message: 'The example.com domain is not verified.' }, 'domain_not_verified'],
      ['another 403', 403, { name: 'forbidden' }, 'provider_error'],
      ['a bad request', 400, { name: 'validation_error' }, 'invalid_message'],
      ['an invalid From', 422, { name: 'invalid_from_address' }, 'invalid_message'],
      ['a rate limit', 429, { name: 'rate_limit_exceeded' }, 'rate_limited'],
      ['a daily quota', 429, { name: 'daily_quota_exceeded' }, 'quota_exceeded'],
      ['a monthly quota', 429, { name: 'monthly_quota_exceeded' }, 'quota_exceeded'],
      ['a server error', 500, { name: 'internal_server_error' }, 'provider_error'],
    ]

    for (const [label, status, body, code] of cases) {
      it(`maps ${label} to ${code}`, async () => {
        const { fetch } = fakeFetch(json(body, status), json(body, status))

        await expect(createResendDriver({ apiKey: 're_key', fetch }).send(message, context)).rejects.toMatchObject({ code })
      })
    }

    it('keeps the provider error name and the status', () => {
      const error = mapResendError(403, { name: 'validation_error', message: 'x' })

      expect(error).toBeInstanceOf(PlutoMailError)
      expect(error.status).toBe(403)
      expect(error.providerCode).toBe('validation_error')
    })

    it('never repeats the provider text, the recipient or the key in the error', async () => {
      const { fetch } = fakeFetch(
        json({ name: 'validation_error', message: 'You can only send testing emails to your own email address (owner@secret.test).' }, 403)
      )

      const error = (await createResendDriver({ apiKey: 're_secret_key', fetch })
        .send({ ...message, to: 'ana@example.com' }, context)
        .catch((caught: unknown) => caught)) as PlutoMailError

      expect(error).toBeInstanceOf(PlutoMailError)
      expect(error.message).not.toContain('owner@secret.test')
      expect(error.message).not.toContain('ana@example.com')
      expect(error.message).not.toContain('re_secret_key')
    })

    it('reports a network error as network', async () => {
      const { fetch } = fakeFetch(new TypeError('fetch failed'), new TypeError('fetch failed'))

      await expect(createResendDriver({ apiKey: 're_key', fetch }).send(message, context)).rejects.toMatchObject({ code: 'network' })
    })

    it('reads a body that is not JSON', async () => {
      const { fetch } = fakeFetch(new Response('<html>bad gateway</html>', { status: 502 }), new Response('', { status: 502 }))

      await expect(createResendDriver({ apiKey: 're_key', fetch }).send(message, context)).rejects.toMatchObject({
        code: 'provider_error',
        status: 502,
      })
    })
  })
})

describe('resend client', () => {
  it('sends GET without a body or a content type', async () => {
    const { fetch, calls } = fakeFetch(json({ data: [] }))

    const result = await createResendClient({ apiKey: 're_key', fetch }).request('GET', '/domains')

    expect(result).toEqual({ data: [] })
    expect(calls[0]!.init.body).toBeUndefined()
    expect(headersOf(calls[0]!)['Content-Type']).toBeUndefined()
    expect(headersOf(calls[0]!)['User-Agent']).toBe(RESEND_USER_AGENT)
  })

  it('does not retry a call that did not ask for a retry', async () => {
    const { fetch, calls } = fakeFetch(json({}, 500), json({ ok: true }))

    await expect(createResendClient({ apiKey: 're_key', fetch }).request('GET', '/domains')).rejects.toMatchObject({ status: 500 })
    expect(calls).toHaveLength(1)
  })
})

describe('dev driver', () => {
  it('prints the email in development, text version included', async () => {
    const log = vi.fn()
    const driver = createDevDriver({ dev: true, log })

    const result = await driver.send({ ...message, text: 'Open https://example.com/invite?t=1' }, context)

    expect(result).toEqual({ id: null, driver: 'dev' })
    expect(log).toHaveBeenCalledTimes(1)
    const output = String(log.mock.calls[0]![0])
    expect(output).toContain('Subject: Hello')
    expect(output).toContain('https://example.com/invite?t=1')
  })

  it('logs nothing outside development', async () => {
    const log = vi.fn()
    const { fetch } = fakeFetch(json({ ID: 'mp_1' }))

    await createDevDriver({ dev: false, mailpitUrl: 'http://localhost:8025', fetch, log }).send(message, context)

    expect(log).not.toHaveBeenCalled()
  })

  it('refuses to send outside development when there is no Mailpit', async () => {
    const driver = createDevDriver({ dev: false })

    await expect(driver.send(message, context)).rejects.toMatchObject({ code: 'not_configured' })
    expect(driver.isConfigured?.()).toBe(false)
  })

  it('posts to Mailpit when a URL is set', async () => {
    const { fetch, calls } = fakeFetch(json({ ID: 'mp_1' }))

    const result = await createDevDriver({ dev: true, mailpitUrl: 'http://localhost:8025/', fetch, log: vi.fn() })
      .send({ ...message, replyTo: 'Support <s@example.com>' }, context)

    expect(result).toEqual({ id: 'mp_1', driver: 'dev' })
    expect(calls[0]!.url).toBe('http://localhost:8025/api/v1/send')
    expect(JSON.parse(String(calls[0]!.init.body))).toEqual({
      From: { Email: 'hello@example.com', Name: 'Shop' },
      To: [{ Email: 'ana@example.com' }],
      ReplyTo: [{ Email: 's@example.com', Name: 'Support' }],
      Subject: 'Hello',
      HTML: '<p>Hi</p>',
      Text: 'Hi',
    })
  })

  it('maps a Mailpit failure to a mail error', async () => {
    const { fetch } = fakeFetch(json({}, 500))
    const driver = createDevDriver({ dev: true, mailpitUrl: 'http://localhost:8025', fetch, log: vi.fn() })

    await expect(driver.send(message, context)).rejects.toMatchObject({ code: 'provider_error', status: 500 })
  })

  it('maps an unreachable Mailpit to network', async () => {
    const { fetch } = fakeFetch(new TypeError('fetch failed'))
    const driver = createDevDriver({ dev: true, mailpitUrl: 'http://localhost:8025', fetch, log: vi.fn() })

    await expect(driver.send(message, context)).rejects.toMatchObject({ code: 'network' })
  })

  it('parses a plain address and a named address', () => {
    expect(parseAddress('a@example.com')).toEqual({ Email: 'a@example.com' })
    expect(parseAddress('"Shop Name" <a@example.com>')).toEqual({ Email: 'a@example.com', Name: 'Shop Name' })
  })
})

describe('none driver', () => {
  it('throws not_configured on every send', async () => {
    const driver = createNoneDriver()

    await expect(driver.send(message, context)).rejects.toMatchObject({ code: 'not_configured' })
    expect(driver.isConfigured?.()).toBe(false)
  })
})

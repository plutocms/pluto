import type { PlutoMailDriver } from '../shared/types/mail'
import { afterEach, describe, expect, it, vi } from 'vitest'

// server/utils/pluto-mail.ts keeps module-scope registries. A fresh import
// for each test gives each test its own copy, like the content registry tests.
afterEach(() => {
  vi.resetModules()
  vi.restoreAllMocks()
})

async function load() {
  return import('../server/utils/pluto-mail')
}

const message = { to: 'ana@example.com', subject: 'Hi', html: '<p>Hi</p>', text: 'Hi' }

function okFetch() {
  const calls: Array<{
 url: string
init: RequestInit
}> = []
  const fetch = vi.fn(async (url: string | URL | Request, init: RequestInit = {}) => {
    calls.push({ url: String(url), init })
    return new Response(JSON.stringify({ id: 'msg_1' }), { status: 200 })
  }) as unknown as typeof globalThis.fetch
  return { fetch, calls }
}

describe('resolveMailDriver: driver choice', () => {
  it('uses the driver from the environment first', async () => {
    const { resolveMailDriver } = await load()

    const { status } = await resolveMailDriver({
      config: { driver: 'none', resend: { apiKey: 're_key' } },
      dev: true,
    })

    expect(status).toMatchObject({ driver: 'none', source: 'env', configured: false, hasKey: true })
  })

  it('uses resend when a key resolves', async () => {
    const { resolveMailDriver } = await load()

    const { status } = await resolveMailDriver({ config: { resend: { apiKey: 're_key' } }, dev: true })

    expect(status).toMatchObject({ driver: 'resend', source: 'key', configured: true, hasKey: true })
  })

  it('uses dev in development with no key', async () => {
    const { resolveMailDriver } = await load()

    const { status } = await resolveMailDriver({ config: {}, dev: true })

    expect(status).toMatchObject({ driver: 'dev', source: 'dev', configured: true, hasKey: false, logOnly: true, mailpit: false })
  })

  it('never falls back to dev in production', async () => {
    const { resolveMailDriver } = await load()

    const { status } = await resolveMailDriver({ config: { mailpit: { url: 'http://localhost:8025' } }, dev: false })

    expect(status).toMatchObject({ driver: 'none', source: 'none', configured: false })
  })

  it('lets production choose dev with the env driver, and needs Mailpit then', async () => {
    const { resolveMailDriver } = await load()

    expect((await resolveMailDriver({ config: { driver: 'dev' }, dev: false })).status.configured).toBe(false)
    expect((await resolveMailDriver({ config: { driver: 'dev', mailpit: { url: 'http://m:8025' } }, dev: false })).status)
      .toMatchObject({ driver: 'dev', configured: true, mailpit: true, logOnly: false })
  })

  it('reports mailpit in development when the URL is set', async () => {
    const { resolveMailDriver } = await load()

    const { status } = await resolveMailDriver({ config: { mailpit: { url: 'http://localhost:8025' } }, dev: true })

    expect(status).toMatchObject({ driver: 'dev', mailpit: true, logOnly: false })
  })

  it('ignores the case and spaces of the env driver', async () => {
    const { resolveMailDriver } = await load()

    expect((await resolveMailDriver({ config: { driver: ' Resend ' }, dev: false })).status.driver).toBe('resend')
  })

  it('falls back to none for an unknown driver and warns once', async () => {
    const { resolveMailDriver } = await load()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    expect((await resolveMailDriver({ config: { driver: 'smtp' }, dev: true })).status).toMatchObject({ driver: 'none', source: 'env' })
    await resolveMailDriver({ config: { driver: 'smtp' }, dev: true })

    expect(warn).toHaveBeenCalledTimes(1)
  })

  it('reads runtimeConfig.plutoMail when no config is passed', async () => {
    vi.stubGlobal('useRuntimeConfig', () => ({ plutoMail: { driver: '', from: 'Shop <a@b.test>', replyTo: '', resend: { apiKey: 're_key' }, mailpit: { url: '' } } }))
    const { resolveMailDriver } = await load()

    const { status } = await resolveMailDriver({ dev: false })

    expect(status).toMatchObject({ driver: 'resend', from: 'Shop <a@b.test>' })
    vi.unstubAllGlobals()
  })

  it('reports the From and Reply-To addresses and no secret', async () => {
    const { resolveMailDriver } = await load()

    const { status } = await resolveMailDriver({
      config: { from: 'Shop <hello@example.com>', replyTo: 'help@example.com', resend: { apiKey: 're_secret' } },
      dev: false,
    })

    expect(status.from).toBe('Shop <hello@example.com>')
    expect(status.replyTo).toBe('help@example.com')
    expect(JSON.stringify(status)).not.toContain('re_secret')
  })
})

describe('registerMailDriver and registerMailStore', () => {
  const custom: PlutoMailDriver = {
    id: 'custom',
    send: vi.fn(async () => ({ id: 'c1', driver: 'custom' })),
  }

  it('selects a registered driver by id', async () => {
    const { registerMailDriver, sendPlutoMail } = await load()
    registerMailDriver(custom)

    const result = await sendPlutoMail(message, { config: { driver: 'custom', from: 'a@b.test' }, dev: false })

    expect(result).toEqual({ id: 'c1', driver: 'custom' })
    expect(custom.send).toHaveBeenCalledWith(message, { from: 'a@b.test', replyTo: '' })
  })

  it('reports a registered driver without isConfigured as configured', async () => {
    const { registerMailDriver, getPlutoMailStatus } = await load()
    registerMailDriver(custom)

    expect(await getPlutoMailStatus({ config: { driver: 'custom' }, dev: false })).toMatchObject({ driver: 'custom', configured: true })
  })

  it('lets a registered driver replace a built-in one', async () => {
    const { registerMailDriver, resolveMailDriver } = await load()
    registerMailDriver({ ...custom, id: 'resend' })

    expect((await resolveMailDriver({ config: { resend: { apiKey: 're_key' } }, dev: false })).driver.send).toBe(custom.send)
  })

  it('takes the key from a store when the env has none', async () => {
    const { registerMailStore, resolveMailDriver } = await load()
    registerMailStore({ id: 'vault', get: async () => 're_from_store' })

    const resolution = await resolveMailDriver({ config: {}, dev: false })

    expect(resolution.status).toMatchObject({ driver: 'resend', source: 'key', hasKey: true })
    expect(resolution.resendKey).toBe('re_from_store')
  })

  it('lets the env key win over the store', async () => {
    const { registerMailStore, resolveMailDriver } = await load()
    const get = vi.fn(async () => 're_from_store')
    registerMailStore({ id: 'vault', get })

    const resolution = await resolveMailDriver({ config: { resend: { apiKey: 're_from_env' } }, dev: false })

    expect(resolution.resendKey).toBe('re_from_env')
    expect(get).not.toHaveBeenCalled()
  })

  it('treats a store that throws as no key', async () => {
    const { registerMailStore, resolveMailDriver } = await load()
    registerMailStore({ id: 'vault', get: async () => {
 throw new Error('vault down')
} })

    expect((await resolveMailDriver({ config: {}, dev: false })).status.driver).toBe('none')
  })
})

describe('sendPlutoMail', () => {
  it('sends through resend with the configured From and Reply-To', async () => {
    const { sendPlutoMail } = await load()
    const { fetch, calls } = okFetch()

    const result = await sendPlutoMail(message, {
      config: { from: 'Shop <hello@example.com>', replyTo: 'help@example.com', resend: { apiKey: 're_key' } },
      dev: false,
      fetch,
    })

    expect(result).toEqual({ id: 'msg_1', driver: 'resend' })
    expect(JSON.parse(String(calls[0]!.init.body))).toMatchObject({ from: 'Shop <hello@example.com>', reply_to: 'help@example.com' })
  })

  it('throws not_configured when the driver is none', async () => {
    const { sendPlutoMail } = await load()

    await expect(sendPlutoMail(message, { config: {}, dev: false })).rejects.toMatchObject({ code: 'not_configured' })
  })

  it('throws a PlutoMailError that isPlutoMailError accepts', async () => {
    const { sendPlutoMail, isPlutoMailError, PlutoMailError } = await load()

    const error = await sendPlutoMail(message, { config: {}, dev: false }).catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(PlutoMailError)
    expect(isPlutoMailError(error)).toBe(true)
  })

  it('rejects a header value with a line break', async () => {
    const { sendPlutoMail } = await load()
    const { fetch, calls } = okFetch()
    const config = { resend: { apiKey: 're_key' } }

    for (const bad of [
      { ...message, subject: 'Hi\r\nBcc: evil@example.com' },
      { ...message, to: 'ana@example.com\nBcc: evil@example.com' },
      { ...message, from: 'a@b.test\nX-Evil: 1' },
      { ...message, replyTo: 'a@b.test\r\nX-Evil: 1' },
    ]) {
      await expect(sendPlutoMail(bad, { config, dev: false, fetch })).rejects.toMatchObject({ code: 'invalid_message' })
    }
    expect(calls).toHaveLength(0)
  })

  it('rejects a message with no valid recipient', async () => {
    const { sendPlutoMail } = await load()

    await expect(sendPlutoMail({ ...message, to: [] }, { config: {}, dev: false })).rejects.toMatchObject({ code: 'invalid_message' })
    await expect(sendPlutoMail({ ...message, to: 'not-an-address' }, { config: {}, dev: false })).rejects.toMatchObject({ code: 'invalid_message' })
  })

  it('writes nothing to the console on a send', async () => {
    const { sendPlutoMail } = await load()
    const { fetch } = okFetch()
    const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((name) => vi.spyOn(console, name).mockImplementation(() => {}))

    await sendPlutoMail(message, { config: { resend: { apiKey: 're_key' } }, dev: false, fetch })
    await sendPlutoMail(message, { config: {}, dev: false }).catch(() => {})

    for (const spy of spies) {
      expect(spy).not.toHaveBeenCalled()
    }
  })
})

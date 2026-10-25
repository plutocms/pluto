import type { H3Event } from 'h3'
import type { PlutoMailDomain, PlutoMailDomainRecord } from '../../shared/types/mail'
import { getRouterParam, readBody, setResponseHeader } from 'h3'
import { isPlutoMailAddress, isPlutoMailDomain, PLUTO_MAIL_REGIONS } from '../../shared/utils/mail'
import { createPlutoError } from '../utils/pluto-error'
import { getPlutoMailStatus, renderPlutoEmail, sendPlutoMail } from '../utils/pluto-mail'
import { enforceTestMailRateLimit, requireMailAdmin, requireResendClient, withMailErrors } from '../utils/pluto-mail-admin'
import { PlutoMailError } from './errors'

/**
 * The logic behind the admin mail routes (`server/api/_pluto/mail/**`). Each
 * route file only calls one of these functions. Every function starts with
 * `requireMailAdmin`, so a route can never run without the admin check.
 *
 * The Resend key never leaves the server. The one exception is the new
 * sending-only key that `createSendingKey` makes: the admin copies it into
 * the environment, and the response says `no-store`.
 */

function invalid(key: string, message: string) {
  return createPlutoError({ statusCode: 400, message, key })
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function isResourceId(value: string): boolean {
  return /^[\w-]{8,64}$/.test(value)
}

function toDomain(raw: unknown): PlutoMailDomain {
  const domain = (raw ?? {}) as Record<string, unknown>
  const records = Array.isArray(domain.records) ? domain.records : []

  return {
    id: text(domain.id),
    name: text(domain.name),
    status: text(domain.status) || 'not_started',
    region: text(domain.region),
    records: records.map((entry): PlutoMailDomainRecord => {
      const record = (entry ?? {}) as Record<string, unknown>
      return {
        record: text(record.record),
        name: text(record.name),
        type: text(record.type),
        value: text(record.value),
        ttl: String(record.ttl ?? ''),
        status: text(record.status) || 'not_started',
        priority: typeof record.priority === 'number' ? record.priority : null,
      }
    }),
  }
}

/** The mail status: driver, From address, key present or not. No secret. */
export async function mailStatus(event: H3Event) {
  await requireMailAdmin(event)
  return getPlutoMailStatus()
}

/**
 * Sends the test email to `to`. 5 calls in 10 minutes for each admin. The body
 * is `{ to, locale? }`. `locale` picks the language of the email.
 */
export async function mailTest(event: H3Event) {
  await requireMailAdmin(event, { write: true })
  enforceTestMailRateLimit(event)

  const body = (await readBody<Record<string, unknown> | null>(event).catch(() => null)) ?? {}
  const to = text(body.to).trim()
  if (!isPlutoMailAddress(to)) {
    throw invalid('pluto.mail.errors.invalidEmail', 'Enter a valid email address.')
  }

  return withMailErrors(async () => {
    const email = await renderPlutoEmail('test', {}, { locale: text(body.locale) || null })
    const result = await sendPlutoMail({ to, ...email })
    return { ok: true, id: result.id, driver: result.driver }
  })
}

/**
 * Checks the Resend key with `GET /domains`. A full-access key lists the
 * domains. A sending-only key gets `access: 'sending'`: it can send, but it
 * cannot manage domains.
 */
export async function mailCheckKey(event: H3Event) {
  await requireMailAdmin(event, { write: true })

  return withMailErrors(async () => {
    const client = await requireResendClient()
    try {
      const result = await client.request<{
 data?: unknown[]
}>('GET', '/domains')
      return { access: 'full' as const, domains: (result?.data ?? []).map(toDomain) }
    } catch (error) {
      if (error instanceof PlutoMailError && error.code === 'restricted_key') {
        return { access: 'sending' as const, domains: [] as PlutoMailDomain[] }
      }
      throw error
    }
  })
}

/** Creates a domain in Resend. The body is `{ name, region? }`. Returns the DNS records. */
export async function mailCreateDomain(event: H3Event) {
  await requireMailAdmin(event, { write: true })

  const body = (await readBody<Record<string, unknown> | null>(event).catch(() => null)) ?? {}
  const name = text(body.name).trim().toLowerCase()
  const region = text(body.region) || 'us-east-1'
  if (!isPlutoMailDomain(name)) {
    throw invalid('pluto.mail.errors.invalidDomain', 'Enter a domain name such as example.com.')
  }
  if (!(PLUTO_MAIL_REGIONS as readonly string[]).includes(region)) {
    throw invalid('pluto.mail.errors.invalidRegion', 'Choose one of the listed regions.')
  }

  return withMailErrors(async () => {
    const client = await requireResendClient()
    return toDomain(await client.request('POST', '/domains', { body: { name, region } }))
  })
}

function domainId(event: H3Event): string {
  const id = getRouterParam(event, 'id') ?? ''
  if (!isResourceId(id)) {
    throw invalid('pluto.mail.errors.invalidDomainId', 'The domain id is not valid.')
  }
  return id
}

/** Reads one domain, with its DNS records and status. */
export async function mailGetDomain(event: H3Event) {
  await requireMailAdmin(event)
  const id = domainId(event)

  return withMailErrors(async () => {
    const client = await requireResendClient()
    return toDomain(await client.request('GET', `/domains/${encodeURIComponent(id)}`))
  })
}

/** Asks Resend to check the DNS records of a domain now. */
export async function mailVerifyDomain(event: H3Event) {
  await requireMailAdmin(event, { write: true })
  const id = domainId(event)

  return withMailErrors(async () => {
    const client = await requireResendClient()
    await client.request('POST', `/domains/${encodeURIComponent(id)}/verify`)
    return { ok: true }
  })
}

/**
 * Makes a sending-only key for one domain. The body is `{ domainId? }`. It
 * needs a full-access key. The response holds the new key once, so the admin
 * can copy it into the environment. Nothing stores or logs it.
 */
export async function mailCreateSendingKey(event: H3Event) {
  await requireMailAdmin(event, { write: true })

  const body = (await readBody<Record<string, unknown> | null>(event).catch(() => null)) ?? {}
  const domain = text(body.domainId).trim()
  if (domain && !isResourceId(domain)) {
    throw invalid('pluto.mail.errors.invalidDomainId', 'The domain id is not valid.')
  }

  return withMailErrors(async () => {
    const client = await requireResendClient()
    const result = await client.request<{
 token?: string
}>('POST', '/api-keys', {
      body: {
        name: 'Pluto sending key',
        permission: 'sending_access',
        ...(domain ? { domain_id: domain } : {}),
      },
    })
    if (typeof result?.token !== 'string' || !result.token) {
      throw new PlutoMailError('provider_error', 'Resend did not return a key.')
    }
    setResponseHeader(event, 'Cache-Control', 'no-store')
    return { token: result.token }
  })
}

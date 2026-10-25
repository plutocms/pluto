/**
 * The mail contract. Pluto sends its own emails (invites, tests, and later
 * notifications) through one driver. The built-in drivers are `resend`, `dev`
 * and `none`. A layer can register another one with `registerMailDriver`.
 * See the mail skill.
 */

/** One email. The same message works with every driver. */
export interface PlutoMailMessage {
  /** One address or a list. */
  to: string | string[]
  subject: string
  html: string
  /** The plain text version. Always send one. */
  text: string
  /** "Name <address>" or an address. Default: the configured From address. */
  from?: string
  /** Default: the configured Reply-To address. */
  replyTo?: string
  /** One key for one logical send. A retry reuses it. Default: a random UUID. */
  idempotencyKey?: string
}

/** What a driver returns after it sent a message. */
export interface PlutoMailSendResult {
  /** The id the provider gave the message, when it gives one. */
  id: string | null
  /** The id of the driver that sent it. */
  driver: string
}

/**
 * Why a send failed. The admin shows a translated hint for each code
 * (`pluto.mail.errors.<code>`).
 *
 * - `not_configured`: no driver can send (driver `none`, or no key).
 * - `invalid_key`: the provider rejected the key.
 * - `restricted_key`: the key is send-only and the call needs full access.
 * - `test_sender_only`: the From domain is not verified, so the provider
 *   sends only to the account owner.
 * - `domain_not_verified`: the From domain is not verified.
 * - `invalid_message`: the provider rejected the message or the request.
 * - `rate_limited`: too many requests. Try again soon.
 * - `quota_exceeded`: the daily or monthly quota of the plan is used.
 * - `timeout`: the provider did not answer in time.
 * - `network`: the request did not reach the provider.
 * - `provider_error`: any other provider failure.
 */
export type PlutoMailErrorCode =
  | 'not_configured'
  | 'invalid_key'
  | 'restricted_key'
  | 'test_sender_only'
  | 'domain_not_verified'
  | 'invalid_message'
  | 'rate_limited'
  | 'quota_exceeded'
  | 'timeout'
  | 'network'
  | 'provider_error'

/** The configuration a driver gets with each send. Secrets are already resolved. */
export interface PlutoMailSendContext {
  /** The From address to use when the message has none. May be empty. */
  from: string
  replyTo: string
}

/**
 * A mail backend. `send` throws a `PlutoMailError` on failure and never logs
 * a recipient, a subject, a link or a key.
 */
export interface PlutoMailDriver {
  /** The value of `NUXT_PLUTO_MAIL_DRIVER` that selects this driver. */
  id: string
  /** False when the driver cannot send yet (for example, a missing key). Default true. */
  isConfigured?: () => boolean
  send: (message: PlutoMailMessage, context: PlutoMailSendContext) => Promise<PlutoMailSendResult>
}

/**
 * Where secrets come from besides the environment. A backend layer can
 * register one (a later version keeps the key in a vault). The environment
 * always wins over a store.
 */
export interface PlutoMailStore {
  id: string
  get: (name: 'resendApiKey') => Promise<string | null>
}

/** The private `runtimeConfig.plutoMail`. Set it with `NUXT_PLUTO_MAIL_*` variables. */
export interface PlutoMailConfig {
  /** `resend`, `dev`, `none`, or the id of a registered driver. Empty means automatic. */
  driver: string
  /** The From address, for example `Shop <hello@example.com>`. */
  from: string
  replyTo: string
  resend: {
 apiKey: string
}
  mailpit: {
 url: string
}
}

/** What the admin shows about the mail setup. It holds no secret. */
export interface PlutoMailStatus {
  /** The id of the driver in use. */
  driver: string
  /** True when the driver can send. */
  configured: boolean
  /** How the driver was chosen. `env` means `NUXT_PLUTO_MAIL_DRIVER` set it. */
  source: 'env' | 'key' | 'dev' | 'none'
  /** True when a Resend key resolved (from the env or a store). */
  hasKey: boolean
  /** The configured From address, or null. */
  from: string | null
  replyTo: string | null
  /** True when the dev driver only logs the mail and nothing leaves the machine. */
  logOnly: boolean
  /** True when the dev driver posts to Mailpit. */
  mailpit: boolean
}

/** One DNS record that Resend asks the site to add for a domain. */
export interface PlutoMailDomainRecord {
  /** The purpose: `SPF`, `DKIM`, `Receiving`. */
  record: string
  name: string
  /** The DNS type: `MX`, `TXT`, `CNAME`. */
  type: string
  value: string
  ttl: string
  status: string
  priority: number | null
}

/** A sending domain in Resend, as the admin sees it. */
export interface PlutoMailDomain {
  id: string
  name: string
  /** `not_started`, `pending`, `verified`, `partially_verified`, `partially_failed`, `failed`, `temporary_failure`. */
  status: string
  region: string
  records: PlutoMailDomainRecord[]
}

/** The answer of the key check. `sending` means the key can send, but it cannot manage domains. */
export interface PlutoMailKeyCheck {
  access: 'full' | 'sending'
  domains: PlutoMailDomain[]
}

import type {
  PlutoMailConfig,
  PlutoMailDriver,
  PlutoMailMessage,
  PlutoMailSendContext,
  PlutoMailSendResult,
  PlutoMailStatus,
  PlutoMailStore,
} from '../../shared/types/mail'
import type { PlutoEmailContent } from '../mail/templates/context'
import type { PlutoInviteEmailData } from '../mail/templates/invite'
import { createDevDriver } from '../mail/drivers/dev'
import { createNoneDriver } from '../mail/drivers/none'
import { createResendDriver } from '../mail/drivers/resend'
import { PlutoMailError } from '../mail/errors'
import { renderInviteEmail } from '../mail/templates/invite'
import { renderTestEmail } from '../mail/templates/test'
import { usePlutoServerTranslator } from './pluto-i18n'

export { isPlutoMailError, PlutoMailError } from '../mail/errors'

/**
 * The server-side mail registry. Like `server/utils/pluto-content.ts`, it is a
 * module-scope singleton on purpose: a layer registers a driver or a store
 * once, at Nitro startup, and the registered objects hold no per-request
 * state. The secrets come from `runtimeConfig.plutoMail` (set by
 * `NUXT_PLUTO_MAIL_*` variables) on each call, never from module state.
 */

const drivers = new Map<string, PlutoMailDriver>()
let store: PlutoMailStore | undefined

/**
 * Registers a mail driver. `NUXT_PLUTO_MAIL_DRIVER=<id>` selects it. A
 * registered driver with the id `resend`, `dev` or `none` replaces the
 * built-in one.
 */
export function registerMailDriver(driver: PlutoMailDriver): void {
  drivers.set(driver.id.toLowerCase(), driver)
}

/**
 * Registers a secret store, for a key that does not live in the
 * environment. The last store wins. The environment always wins over a store.
 */
export function registerMailStore(next: PlutoMailStore): void {
  store = next
}

export interface ResolveMailOptions {
  /** Default: `useRuntimeConfig().plutoMail`. */
  config?: Partial<PlutoMailConfig>
  /** Default: `import.meta.dev`. */
  dev?: boolean
  /** Default: the global `fetch`. A test passes a fake. */
  fetch?: typeof fetch
}

/** What `resolveMailDriver` returns: the driver, its send context, and the status. */
export interface PlutoMailResolution {
  driver: PlutoMailDriver
  context: PlutoMailSendContext
  status: PlutoMailStatus
  /** The Resend key that resolved. Server only. Never put it in a response. */
  resendKey: string
}

function normalizeConfig(
  raw: Partial<PlutoMailConfig> | undefined
): PlutoMailConfig {
  return {
    driver: String(raw?.driver ?? '')
      .trim()
      .toLowerCase(),
    from: String(raw?.from ?? '').trim(),
    replyTo: String(raw?.replyTo ?? '').trim(),
    resend: { apiKey: String(raw?.resend?.apiKey ?? '').trim() },
    mailpit: { url: String(raw?.mailpit?.url ?? '').trim() },
  }
}

const warnedDrivers = new Set<string>()

/**
 * Picks the mail driver. The order:
 *
 * 1. `NUXT_PLUTO_MAIL_DRIVER` (`plutoMail.driver`): a registered driver, or
 *    `resend`, `dev`, `none`.
 * 2. `resend`, when a Resend key resolves (the environment, then a store).
 * 3. `dev`, in development.
 * 4. `none`.
 *
 * Production never falls back to `dev`.
 */
export async function resolveMailDriver(
  options: ResolveMailOptions = {}
): Promise<PlutoMailResolution> {
  const config = normalizeConfig(options.config ?? useRuntimeConfig().plutoMail)
  const dev = options.dev ?? import.meta.dev

  const resendKey =
    config.resend.apiKey ||
    (await store?.get('resendApiKey').catch(() => null)) ||
    ''
  const hasKey = Boolean(resendKey)
  const mailpitUrl = config.mailpit.url

  const builtIn: Record<string, () => PlutoMailDriver> = {
    resend: () =>
      createResendDriver({ apiKey: resendKey, fetch: options.fetch }),
    dev: () => createDevDriver({ dev, mailpitUrl, fetch: options.fetch }),
    none: () => createNoneDriver(),
  }

  let source: PlutoMailStatus['source']
  let driver: PlutoMailDriver

  if (config.driver) {
    source = 'env'
    const known = drivers.get(config.driver) ?? builtIn[config.driver]?.()
    if (known) {
      driver = known
    } else {
      if (!warnedDrivers.has(config.driver)) {
        warnedDrivers.add(config.driver)
        console.warn(
          `[pluto-mail] Unknown mail driver "${config.driver}". Using "none".`
        )
      }
      driver = createNoneDriver()
    }
  } else if (hasKey) {
    source = 'key'
    driver = drivers.get('resend') ?? builtIn.resend!()
  } else if (dev) {
    source = 'dev'
    driver = drivers.get('dev') ?? builtIn.dev!()
  } else {
    source = 'none'
    driver = drivers.get('none') ?? builtIn.none!()
  }

  const status: PlutoMailStatus = {
    driver: driver.id,
    configured: driver.isConfigured ? driver.isConfigured() : true,
    source,
    hasKey,
    from: config.from || null,
    replyTo: config.replyTo || null,
    logOnly: driver.id === 'dev' && dev && !mailpitUrl,
    mailpit: driver.id === 'dev' && Boolean(mailpitUrl),
  }

  return {
    driver,
    context: { from: config.from, replyTo: config.replyTo },
    status,
    resendKey,
  }
}

/** What the admin shows about the mail setup. It holds no secret. */
export async function getPlutoMailStatus(
  options: ResolveMailOptions = {}
): Promise<PlutoMailStatus> {
  return (await resolveMailDriver(options)).status
}

const HEADER_BREAK = /[\r\n]/

function assertMessage(message: PlutoMailMessage): void {
  const recipients = Array.isArray(message.to) ? message.to : [message.to]
  const headers = [
    message.subject,
    message.from ?? '',
    message.replyTo ?? '',
    ...recipients,
  ]

  if (
    recipients.length === 0 ||
    recipients.some((to) => typeof to !== 'string' || !to.includes('@'))
  ) {
    throw new PlutoMailError(
      'invalid_message',
      'The message needs at least one valid recipient.'
    )
  }
  // A line break in a header value could add a header (header injection).
  if (
    headers.some(
      (value) => typeof value !== 'string' || HEADER_BREAK.test(value)
    )
  ) {
    throw new PlutoMailError(
      'invalid_message',
      'A header value has a line break.'
    )
  }
}

/**
 * Sends one email through the resolved driver. It throws a `PlutoMailError`
 * on failure. It logs nothing: not a recipient, a subject, a link or a key.
 */
export async function sendPlutoMail(
  message: PlutoMailMessage,
  options: ResolveMailOptions = {}
): Promise<PlutoMailSendResult> {
  assertMessage(message)
  const { driver, context } = await resolveMailDriver(options)
  return driver.send(message, context)
}

/** The email templates core ships, and the data each one takes. */
export interface PlutoEmailTemplates {
  test: Record<string, never>
  invite: PlutoInviteEmailData
}

export interface RenderEmailOptions {
  /** The language of the email: a locale code or a language tag. Default: the default locale. */
  locale?: string | null
  /** Default: `runtimeConfig.public.websiteName`. */
  siteName?: string
  /** Default: `usePlutoServerTranslator(locale)`. A test passes its own. */
  translator?: {
    t: (key: string, params?: Record<string, unknown>) => string
    locale: string
  }
}

/**
 * Renders an email template to `{ subject, html, text }` in the language
 * you ask for. The texts are the `pluto.mail.*` keys of the locale files, so
 * an app can override them, and a layer can add a language.
 *
 *     const email = await renderPlutoEmail('invite', { url }, { locale })
 *     await sendPlutoMail({ to, ...email })
 */
export async function renderPlutoEmail<N extends keyof PlutoEmailTemplates>(
  name: N,
  data: PlutoEmailTemplates[N],
  options: RenderEmailOptions = {}
): Promise<PlutoEmailContent> {
  const translator =
    options.translator ?? (await usePlutoServerTranslator(options.locale))
  const context = {
    t: translator.t,
    locale: translator.locale,
    siteName:
      options.siteName ??
      String(useRuntimeConfig().public.websiteName ?? 'Pluto'),
  }

  switch (name) {
    case 'test':
      return renderTestEmail(context)
    case 'invite':
      return renderInviteEmail(context, data as PlutoInviteEmailData)
    default:
      throw new PlutoMailError(
        'invalid_message',
        `Unknown email template "${String(name)}".`
      )
  }
}

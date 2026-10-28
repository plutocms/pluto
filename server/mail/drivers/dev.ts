import type {
  PlutoMailDriver,
  PlutoMailMessage,
} from '../../../shared/types/mail'
import { PlutoMailError } from '../errors'

const DEFAULT_FROM = 'Pluto <pluto@localhost>'
const TIMEOUT_MS = 4000

export interface DevDriverOptions {
  /** True in development. The driver logs the mail only then. */
  dev: boolean
  /** The base URL of a Mailpit server, for example `http://localhost:8025`. Empty: no Mailpit. */
  mailpitUrl?: string
  /** Default: the global `fetch`. A test passes a fake. */
  fetch?: typeof fetch
  /** Default: `console.info`. A test passes a spy. */
  log?: (message: string) => void
}

interface MailpitAddress {
  Email: string
  Name?: string
}

/** Splits `Name <address>` or `address` into the Mailpit shape. */
export function parseAddress(value: string): MailpitAddress {
  const open = value.lastIndexOf('<')
  const close = value.lastIndexOf('>')
  if (open === -1 || close < open) {
    return { Email: value.trim() }
  }
  const name = value.slice(0, open).trim().replace(/^"|"$/g, '')
  const email = value.slice(open + 1, close).trim()
  return name ? { Email: email, Name: name } : { Email: email }
}

async function postToMailpit(
  options: DevDriverOptions,
  message: PlutoMailMessage,
  from: string,
  replyTo: string
) {
  const doFetch = options.fetch ?? globalThis.fetch
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const recipients = Array.isArray(message.to) ? message.to : [message.to]
    const response = await doFetch(
      `${options.mailpitUrl!.replace(/\/+$/, '')}/api/v1/send`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          From: parseAddress(from),
          To: recipients.map(parseAddress),
          ...(replyTo ? { ReplyTo: [parseAddress(replyTo)] } : {}),
          Subject: message.subject,
          HTML: message.html,
          Text: message.text,
        }),
      }
    )
    if (!response.ok) {
      throw new PlutoMailError(
        'provider_error',
        `Mailpit failed with status ${response.status}.`,
        { status: response.status }
      )
    }
    const payload = (await response.json().catch(() => null)) as {
      ID?: string
    } | null
    return typeof payload?.ID === 'string' ? payload.ID : null
  } catch (error) {
    if (error instanceof PlutoMailError) {
      throw error
    }
    throw controller.signal.aborted
      ? new PlutoMailError('timeout', 'Mailpit did not answer in time.')
      : new PlutoMailError('network', 'The request did not reach Mailpit.')
  } finally {
    clearTimeout(timer)
  }
}

/**
 * The driver for local work. In development it prints the email to the
 * console, text version included, so you can copy an invite link. When
 * `mailpitUrl` is set, it also posts the email to Mailpit. Outside
 * development it logs nothing, and with no Mailpit it refuses to send
 * (`not_configured`), so a production site never drops mail in silence.
 */
export function createDevDriver(options: DevDriverOptions): PlutoMailDriver {
  // eslint-disable-next-line no-console -- the dev driver prints the mail on purpose
  const log = options.log ?? ((text: string) => console.info(text))
  const hasMailpit = Boolean(options.mailpitUrl)

  return {
    id: 'dev',
    isConfigured: () => options.dev || hasMailpit,
    async send(message, context) {
      if (!options.dev && !hasMailpit) {
        throw new PlutoMailError(
          'not_configured',
          'The dev mail driver sends nothing outside development.'
        )
      }

      const from = message.from || context.from || DEFAULT_FROM
      const replyTo = message.replyTo || context.replyTo

      if (options.dev) {
        const to = Array.isArray(message.to)
          ? message.to.join(', ')
          : message.to
        log(
          [
            '[pluto-mail] dev driver: this email is not sent. Set NUXT_PLUTO_MAIL_RESEND_API_KEY to send it.',
            `From: ${from}`,
            `To: ${to}`,
            `Subject: ${message.subject}`,
            '',
            message.text,
          ].join('\n')
        )
      }

      const id = hasMailpit
        ? await postToMailpit(options, message, from, replyTo)
        : null
      return { id, driver: 'dev' }
    },
  }
}

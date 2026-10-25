import type { PlutoMailDriver } from '../../../shared/types/mail'
import { PlutoMailError } from '../errors'
import { createResendClient } from '../resend-client'

/**
 * The From address Resend lets every account use. It delivers only to the
 * email address of the Resend account, until the site verifies a domain.
 */
export const RESEND_TEST_SENDER = 'Pluto <onboarding@resend.dev>'

export interface ResendDriverOptions {
  apiKey: string
  /** Default: the global `fetch`. A test passes a fake. */
  fetch?: typeof fetch
  timeoutMs?: number
}

/**
 * Sends through the Resend HTTP API with plain `fetch`. Each attempt has a
 * timeout. A network error, a timeout or a 5xx gets one retry with the same
 * `Idempotency-Key`, so Resend never sends the same message twice.
 */
export function createResendDriver(options: ResendDriverOptions): PlutoMailDriver {
  return {
    id: 'resend',
    isConfigured: () => Boolean(options.apiKey),
    async send(message, context) {
      if (!options.apiKey) {
        throw new PlutoMailError('not_configured', 'The Resend API key is not set.')
      }

      const client = createResendClient({
        apiKey: options.apiKey,
        fetch: options.fetch,
        timeoutMs: options.timeoutMs,
      })

      const replyTo = message.replyTo || context.replyTo
      const result = await client.request<{
 id?: string
}>('POST', '/emails', {
        idempotencyKey: message.idempotencyKey ?? crypto.randomUUID(),
        retry: true,
        body: {
          from: message.from || context.from || RESEND_TEST_SENDER,
          to: Array.isArray(message.to) ? message.to : [message.to],
          subject: message.subject,
          html: message.html,
          text: message.text,
          ...(replyTo ? { reply_to: replyTo } : {}),
        },
      })

      return { id: typeof result?.id === 'string' ? result.id : null, driver: 'resend' }
    },
  }
}

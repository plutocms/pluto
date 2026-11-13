import type { PlutoMailDriver } from '../../../shared/types/mail'
import { PlutoMailError } from '../errors'
import { createResendClient } from '../resend-client'

export const RESEND_TEST_SENDER = 'Pluto <onboarding@resend.dev>'

export interface ResendDriverOptions {
  apiKey: string
  fetch?: typeof fetch
  timeoutMs?: number
}

export function createResendDriver(
  options: ResendDriverOptions
): PlutoMailDriver {
  return {
    id: 'resend',
    isConfigured: () => Boolean(options.apiKey),
    async send(message, context) {
      if (!options.apiKey) {
        throw new PlutoMailError(
          'not_configured',
          'The Resend API key is not set.'
        )
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

      return {
        id: typeof result?.id === 'string' ? result.id : null,
        driver: 'resend',
      }
    },
  }
}

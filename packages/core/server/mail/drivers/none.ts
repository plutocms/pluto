import type { PlutoMailDriver } from '../../../shared/types/mail'
import { PlutoMailError } from '../errors'

/**
 * The driver for a site with no mail setup. Every send fails with
 * `not_configured`. The caller decides what to do: the invite flow, for
 * example, keeps using the auth provider's own mailer.
 */
export function createNoneDriver(): PlutoMailDriver {
  return {
    id: 'none',
    isConfigured: () => false,
    async send() {
      throw new PlutoMailError('not_configured', 'Email is not set up.')
    },
  }
}

import type { PlutoMailDriver } from '../../../shared/types/mail'
import { PlutoMailError } from '../errors'

export function createNoneDriver(): PlutoMailDriver {
  return {
    id: 'none',
    isConfigured: () => false,
    async send() {
      throw new PlutoMailError('not_configured', 'Email is not set up.')
    },
  }
}

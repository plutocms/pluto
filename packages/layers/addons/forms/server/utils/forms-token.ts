import { Buffer } from 'node:buffer'
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

export const PLUTO_FORMS_MIN_FILL_MS = 3000

export const PLUTO_FORMS_TOKEN_MAX_AGE_MS = 24 * 60 * 60 * 1000

export type PlutoFormsTokenVerdict =
  | 'ok'
  | 'invalid'
  | 'too-fast'
  | 'expired'

function sign(secret: string, payload: string): Buffer {
  return createHmac('sha256', secret).update(payload).digest()
}

/**
 * Makes the token that a form gets when it renders. It holds the handle and the time, signed
 * with the secret. The server checks the time when the form comes back: a bot that sends the
 * form at once has no valid token.
 */
export function signFormsToken(
  secret: string,
  handle: string,
  now: number = Date.now()
): string {
  const payload = `${handle}.${now}.${randomBytes(6).toString('hex')}`
  return `${Buffer.from(payload).toString('base64url')}.${sign(secret, payload).toString('base64url')}`
}

/** Checks a token for a form: the signature, the handle, and the time since it was made. */
export function verifyFormsToken(
  secret: string,
  token: unknown,
  handle: string,
  options: {
    now?: number
    minAgeMs?: number
    maxAgeMs?: number
  } = {}
): PlutoFormsTokenVerdict {
  if (typeof token !== 'string' || token.length > 300 || !secret) {
    return 'invalid'
  }
  const [encoded, signature, ...rest] = token.split('.')
  if (!encoded || !signature || rest.length > 0) {
    return 'invalid'
  }
  const payload = Buffer.from(encoded, 'base64url').toString()
  const expected = sign(secret, payload)
  const given = Buffer.from(signature, 'base64url')
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return 'invalid'
  }
  const [tokenHandle, issued] = payload.split('.')
  const issuedAt = Number(issued)
  if (tokenHandle !== handle || !Number.isFinite(issuedAt)) {
    return 'invalid'
  }
  const age = (options.now ?? Date.now()) - issuedAt
  if (age < (options.minAgeMs ?? PLUTO_FORMS_MIN_FILL_MS)) {
    return 'too-fast'
  }
  if (age > (options.maxAgeMs ?? PLUTO_FORMS_TOKEN_MAX_AGE_MS)) {
    return 'expired'
  }
  return 'ok'
}

import { Buffer } from 'node:buffer'
import { createPublicKey, createVerify, generateKeyPairSync } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'
import {
  createAppJwt,
  createAppTokenProvider,
  normalizePem,
} from '../modules/pluto-github/runtime/server/github/app-token'
import { createFakeGithub } from './fixtures/fake-github'

const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
})

const NOW = Date.parse('2026-05-01T12:00:00Z')

function decode(part: string) {
  return JSON.parse(Buffer.from(part, 'base64url').toString('utf8'))
}

function setup(
  options: {
    ttl?: number
    installationId?: number | undefined
    clock?: {
      now: number
    }
  } = {}
) {
  const clock = options.clock ?? { now: NOW }
  const fake = createFakeGithub({
    app: {
      id: '12345',
      installationId: 'installationId' in options ? options.installationId : 99,
      publicKey,
    },
    clock: () => clock.now,
    appTokenTtl: options.ttl,
  })
  return { fake, clock }
}

describe('createAppJwt', () => {
  it('has the RS256 shape and the GitHub claims', () => {
    const jwt = createAppJwt({ appId: '12345', privateKey, now: () => NOW })
    const [header, payload, signature] = jwt.split('.') as [
      string,
      string,
      string,
    ]

    expect(decode(header)).toEqual({ alg: 'RS256', typ: 'JWT' })
    expect(decode(payload)).toEqual({
      iat: NOW / 1000 - 60,
      exp: NOW / 1000 + 540,
      iss: '12345',
    })
    expect(signature).toMatch(/^[\w-]+$/)
  })

  it('has a signature that the public key verifies', () => {
    const jwt = createAppJwt({ appId: '1', privateKey, now: () => NOW })
    const [header, payload, signature] = jwt.split('.') as [
      string,
      string,
      string,
    ]
    const verifier = createVerify('RSA-SHA256')
    verifier.update(`${header}.${payload}`)

    expect(
      verifier.verify(
        createPublicKey(publicKey),
        Buffer.from(signature, 'base64url')
      )
    ).toBe(true)

    const other = createVerify('RSA-SHA256')
    other.update(`${header}.${payload}x`)
    expect(
      other.verify(
        createPublicKey(publicKey),
        Buffer.from(signature, 'base64url')
      )
    ).toBe(false)
  })

  it('accepts a PEM with literal \\n escapes, as an env var holds it', () => {
    const escaped = privateKey.trim().replaceAll('\n', '\\n')

    expect(escaped).not.toContain('\n')
    expect(normalizePem(escaped)).toBe(privateKey.trim())
    expect(() =>
      createAppJwt({ appId: '1', privateKey: escaped, now: () => NOW })
    ).not.toThrow()
  })

  it('accepts a PEM with real line breaks, with spaces around it', () => {
    expect(normalizePem(`\n  ${privateKey}  \n`)).toBe(privateKey.trim())
    expect(normalizePem(privateKey.replaceAll('\n', '\r\n'))).toBe(
      privateKey.trim()
    )
  })

  it('accepts the base64 of the PEM', () => {
    const encoded = Buffer.from(privateKey).toString('base64')

    expect(encoded).not.toContain('-----BEGIN')
    expect(normalizePem(encoded)).toBe(privateKey.trim())
    expect(normalizePem(` ${encoded}\n`)).toBe(privateKey.trim())
    expect(
      createAppJwt({ appId: '1', privateKey: encoded, now: () => NOW }).split(
        '.'
      )
    ).toHaveLength(3)
  })

  it('accepts the base64 of a PEM that has literal \\n escapes', () => {
    const encoded = Buffer.from(
      privateKey.trim().replaceAll('\n', '\\n')
    ).toString('base64')

    expect(normalizePem(encoded)).toBe(privateKey.trim())
  })

  it('leaves a value that is not a key as it is', () => {
    expect(normalizePem(' nope ')).toBe('nope')
    // Base64 text that holds no PEM.
    expect(normalizePem(Buffer.from('hello world').toString('base64'))).toBe(
      Buffer.from('hello world').toString('base64')
    )
    expect(normalizePem('')).toBe('')
  })

  it('throws for a key that is not a PEM', () => {
    expect(() => createAppJwt({ appId: '1', privateKey: 'nope' })).toThrow()
  })
})

describe('createAppTokenProvider', () => {
  it('finds the installation and asks for a contents-read token on this repo', async () => {
    const { fake } = setup()
    const provider = createAppTokenProvider({
      repo: 'acme/site',
      appId: '12345',
      privateKey,
      fetch: fake.fetch,
      now: () => NOW,
    })

    const token = await provider.getReadToken()

    expect(token).toMatch(/^ghs_/)
    expect(fake.installTokens.has(token)).toBe(true)
    expect(fake.appCalls.lookups).toBe(1)
    expect(fake.appCalls.tokenRequests).toEqual([
      { repositories: ['site'], permissions: { contents: 'read' } },
    ])
    expect(fake.appCalls.jwts[0]).toMatchObject({ iss: '12345' })
  })

  it('caches the token until 5 minutes before it ends', async () => {
    const { fake, clock } = setup({ ttl: 3600 })
    const provider = createAppTokenProvider({
      repo: 'acme/site',
      appId: '12345',
      privateKey,
      fetch: fake.fetch,
      now: () => clock.now,
    })

    const first = await provider.getReadToken()
    clock.now = NOW + 54 * 60_000
    expect(await provider.getReadToken()).toBe(first)
    expect(fake.appCalls.tokenRequests).toHaveLength(1)

    clock.now = NOW + 56 * 60_000
    const second = await provider.getReadToken()

    expect(second).not.toBe(first)
    expect(fake.appCalls.tokenRequests).toHaveLength(2)
    // The installation id is cached. It is looked up once.
    expect(fake.appCalls.lookups).toBe(1)
  })

  it('shares one request between calls that run at the same time', async () => {
    const { fake } = setup()
    const provider = createAppTokenProvider({
      repo: 'acme/site',
      appId: '12345',
      privateKey,
      fetch: fake.fetch,
      now: () => NOW,
    })

    const tokens = await Promise.all([
      provider.getReadToken(),
      provider.getReadToken(),
      provider.getReadToken(),
    ])

    expect(new Set(tokens).size).toBe(1)
    expect(fake.appCalls.tokenRequests).toHaveLength(1)
  })

  it('lets the read token override the App', async () => {
    const { fake } = setup()
    const provider = createAppTokenProvider({
      repo: 'acme/site',
      appId: '12345',
      privateKey,
      readToken: 'github_pat_readonly',
      fetch: fake.fetch,
    })

    expect(await provider.getReadToken()).toBe('github_pat_readonly')
    expect(fake.appCalls.lookups).toBe(0)
  })

  it('uses the read token with no App credentials', async () => {
    const provider = createAppTokenProvider({
      repo: 'acme/site',
      appId: '',
      privateKey: '',
      readToken: 'pat',
    })

    expect(await provider.getReadToken()).toBe('pat')
  })

  it('answers 503 and logs when there are no credentials, and does not throw when built', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const provider = createAppTokenProvider({
      repo: 'acme/site',
      appId: '',
      privateKey: '',
    })

    await expect(provider.getReadToken()).rejects.toMatchObject({
      statusCode: 503,
      data: { i18n: { key: 'pluto.github.errors.githubUnavailable' } },
    })
    await expect(provider.getReadToken()).rejects.toMatchObject({
      statusCode: 503,
    })
    expect(spy).toHaveBeenCalledTimes(1)
    spy.mockRestore()
  })

  it('answers 503 for a private key that is not valid', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const provider = createAppTokenProvider({
      repo: 'acme/site',
      appId: '1',
      privateKey: 'not a key',
    })

    await expect(provider.getReadToken()).rejects.toMatchObject({
      statusCode: 503,
    })
    spy.mockRestore()
  })

  it('answers 503 when the App is not installed on the repo, then tries again', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { fake } = setup({ installationId: undefined })
    const provider = createAppTokenProvider({
      repo: 'acme/site',
      appId: '12345',
      privateKey,
      fetch: fake.fetch,
      now: () => NOW,
    })

    await expect(provider.getReadToken()).rejects.toMatchObject({
      statusCode: 503,
    })
    await expect(provider.getReadToken()).rejects.toMatchObject({
      statusCode: 503,
    })

    expect(fake.appCalls.lookups).toBe(2)
    spy.mockRestore()
  })

  it('is refused by GitHub when the key does not match the App', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { fake } = setup()
    const other = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      publicKeyEncoding: { type: 'spki', format: 'pem' },
    })
    const provider = createAppTokenProvider({
      repo: 'acme/site',
      appId: '12345',
      privateKey: other.privateKey,
      fetch: fake.fetch,
      now: () => NOW,
    })

    await expect(provider.getReadToken()).rejects.toMatchObject({
      statusCode: 503,
    })
    spy.mockRestore()
  })
})

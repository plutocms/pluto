import { Buffer } from 'node:buffer'
import { generateKeyPairSync } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import {
  buildAppManifest,
  buildEnvEntries,
  computeSetupChecks,
  firstLanguage,
  formatEnvBlock,
  installUrl,
  isEnvIgnored,
  isLocalOrigin,
  isPrivateKeyReadable,
  manifestAppName,
  manifestFormAction,
  needsInstallationCheck,
  parseConversion,
  repoOwner,
  updateEnvText,
} from '../modules/pluto-github/runtime/server/utils/github-app-setup'

const { privateKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
})

const CONVERSION = {
  id: 4242,
  slug: 'acme-cms',
  client_id: 'Iv1.abc',
  client_secret: 'shh-secret',
  pem: privateKey,
  html_url: 'https://github.com/apps/acme-cms',
  owner: { login: 'acme' },
}

describe('manifestAppName', () => {
  it('adds CMS to the site name', () => {
    expect(manifestAppName('Acme')).toBe('Acme CMS')
    expect(manifestAppName('  Acme   Bakery ')).toBe('Acme Bakery CMS')
  })

  it('uses Pluto when there is no name', () => {
    expect(manifestAppName(undefined)).toBe('Pluto CMS')
    expect(manifestAppName('   ')).toBe('Pluto CMS')
  })

  it('keeps the name at 34 characters or less', () => {
    const name = manifestAppName('A very long site name that goes on and on and on')

    expect(name.length).toBeLessThanOrEqual(34)
    expect(name.endsWith(' CMS')).toBe(true)
  })
})

describe('buildAppManifest', () => {
  it('builds the manifest for a production origin', () => {
    const manifest = buildAppManifest({ siteName: 'Acme', origin: 'https://acme.com/' })

    expect(manifest).toEqual({
      name: 'Acme CMS',
      url: 'https://acme.com',
      hook_attributes: { url: 'https://acme.com', active: false },
      redirect_url: 'https://acme.com/api/_pluto/github/setup/callback',
      callback_urls: [
        'https://acme.com/api/_pluto/auth/github/callback',
        'http://localhost:3000/api/_pluto/auth/github/callback',
      ],
      public: false,
      default_permissions: { contents: 'write', metadata: 'read', checks: 'read', statuses: 'read', deployments: 'read' },
      default_events: [],
      request_oauth_on_install: false,
    })
  })

  it('adds no second callback URL for a local origin', () => {
    const manifest = buildAppManifest({ siteName: 'Acme', origin: 'http://localhost:3140' })

    expect(manifest.callback_urls).toEqual(['http://localhost:3140/api/_pluto/auth/github/callback'])
    expect(manifest.redirect_url).toBe('http://localhost:3140/api/_pluto/github/setup/callback')
  })
})

describe('isLocalOrigin', () => {
  it('knows this machine', () => {
    expect(isLocalOrigin('http://localhost:3000')).toBe(true)
    expect(isLocalOrigin('http://127.0.0.1:3000')).toBe(true)
    expect(isLocalOrigin('http://[::1]:3000')).toBe(true)
    expect(isLocalOrigin('https://acme.com')).toBe(false)
    expect(isLocalOrigin('https://localhost.evil.com')).toBe(false)
    expect(isLocalOrigin('not a url')).toBe(false)
  })
})

describe('manifestFormAction', () => {
  it('posts to the personal page for a user', () => {
    expect(manifestFormAction({ webBase: 'https://github.com', owner: 'ada', ownerType: 'User', state: 'abc' }))
      .toBe('https://github.com/settings/apps/new?state=abc')
  })

  it('posts to the organization page for an organization', () => {
    expect(manifestFormAction({ webBase: 'https://github.com', owner: 'acme', ownerType: 'Organization', state: 'a_b-c' }))
      .toBe('https://github.com/organizations/acme/settings/apps/new?state=a_b-c')
  })

  it('uses the personal page when the owner is unknown', () => {
    expect(manifestFormAction({ webBase: 'https://github.com', state: 's' })).toBe('https://github.com/settings/apps/new?state=s')
    expect(manifestFormAction({ webBase: 'https://github.com', ownerType: 'Organization', state: 's' })).toBe('https://github.com/settings/apps/new?state=s')
  })

  it('uses the host of GitHub Enterprise and encodes the values', () => {
    expect(manifestFormAction({ webBase: 'https://ghe.example.com/', owner: 'a b', ownerType: 'Organization', state: 'x&y' }))
      .toBe('https://ghe.example.com/organizations/a%20b/settings/apps/new?state=x%26y')
  })
})

describe('small helpers', () => {
  it('builds the install URL', () => {
    expect(installUrl('https://github.com', 'acme-cms')).toBe('https://github.com/apps/acme-cms/installations/new')
  })

  it('reads the repo owner', () => {
    expect(repoOwner('acme/site')).toBe('acme')
    expect(repoOwner('')).toBe('')
  })

  it('reads the first language of the header', () => {
    expect(firstLanguage('pt-BR,pt;q=0.9,en;q=0.8')).toBe('pt-BR')
    expect(firstLanguage('en')).toBe('en')
    expect(firstLanguage('')).toBeUndefined()
    expect(firstLanguage(undefined)).toBeUndefined()
  })
})

describe('parseConversion', () => {
  it('reads the fields that the setup needs', () => {
    expect(parseConversion(CONVERSION)).toEqual({
      id: 4242,
      slug: 'acme-cms',
      clientId: 'Iv1.abc',
      clientSecret: 'shh-secret',
      pem: privateKey,
      htmlUrl: 'https://github.com/apps/acme-cms',
    })
  })

  it('returns null when a field is missing', () => {
    expect(parseConversion({ ...CONVERSION, pem: undefined })).toBeNull()
    expect(parseConversion({ ...CONVERSION, client_secret: '' })).toBeNull()
    expect(parseConversion({ ...CONVERSION, id: undefined })).toBeNull()
    expect(parseConversion(null)).toBeNull()
    expect(parseConversion('nope')).toBeNull()
  })
})

describe('buildEnvEntries and formatEnvBlock', () => {
  const app = parseConversion(CONVERSION)!

  it('lists the keys, with the key as one line of base64', () => {
    const entries = buildEnvEntries(app, 'p'.repeat(40))

    expect(entries.map(([key]) => key)).toEqual([
      'NUXT_PLUTO_GITHUB_APP_ID',
      'NUXT_PLUTO_GITHUB_CLIENT_ID',
      'NUXT_PLUTO_GITHUB_CLIENT_SECRET',
      'NUXT_PLUTO_GITHUB_PRIVATE_KEY',
      'PLUTO_GITHUB_APP_SLUG',
      'NUXT_PLUTO_GITHUB_SESSION_PASSWORD',
    ])
    const key = Object.fromEntries(entries).NUXT_PLUTO_GITHUB_PRIVATE_KEY!
    expect(key).not.toContain('\n')
    expect(key).not.toContain('-----BEGIN')
    expect(Buffer.from(key, 'base64').toString('utf8')).toBe(privateKey.trim())
  })

  it('leaves out the session password when the site has one', () => {
    expect(buildEnvEntries(app).map(([key]) => key)).not.toContain('NUXT_PLUTO_GITHUB_SESSION_PASSWORD')
  })

  it('formats one KEY=value line for each entry', () => {
    const block = formatEnvBlock(buildEnvEntries(app, 'x'.repeat(40)))
    const lines = block.trimEnd().split('\n')

    expect(lines).toHaveLength(6)
    expect(lines[0]).toBe('NUXT_PLUTO_GITHUB_APP_ID=4242')
    expect(lines[4]).toBe('PLUTO_GITHUB_APP_SLUG=acme-cms')
    expect(block.endsWith('\n')).toBe(true)
  })
})

describe('updateEnvText', () => {
  const entries: Array<[string, string]> = [['A', '1'], ['B', '2']]

  it('writes the keys into an empty file', () => {
    expect(updateEnvText('', entries)).toBe('A=1\nB=2\n')
  })

  it('replaces a key that exists in its place and appends the others', () => {
    const text = '# site\nOTHER=x\nA=old\n\nLAST=y\n'

    expect(updateEnvText(text, entries)).toBe('# site\nOTHER=x\nA=1\n\nLAST=y\nB=2\n')
  })

  it('keeps the other lines and their order', () => {
    const text = 'Z=1\nA=old\nY=2\nB=old\nX=3'

    expect(updateEnvText(text, entries)).toBe('Z=1\nA=1\nY=2\nB=2\nX=3\n')
  })

  it('handles export, spaces and a quoted value', () => {
    expect(updateEnvText('export A = "old"\nB= \'old\'\n', entries)).toBe('A=1\nB=2\n')
  })

  it('replaces a quoted value that spans lines', () => {
    const text = 'A="-----BEGIN\nline\n-----END"\nKEEP=1\n'

    expect(updateEnvText(text, entries)).toBe('A=1\nKEEP=1\nB=2\n')
  })

  it('keeps a CRLF file as CRLF', () => {
    expect(updateEnvText('KEEP=1\r\nA=old\r\n', entries)).toBe('KEEP=1\r\nA=1\r\nB=2\r\n')
  })

  it('drops a repeated key', () => {
    expect(updateEnvText('A=1\nA=2\n', [['A', '9']])).toBe('A=9\n')
  })

  it('does not touch a key that only starts with the same letters', () => {
    expect(updateEnvText('AB=1\n#A=1\n', [['A', '9']])).toBe('AB=1\n#A=1\nA=9\n')
  })

  it('is stable when it runs twice', () => {
    const once = updateEnvText('KEEP=1\n', entries)

    expect(updateEnvText(once, entries)).toBe(once)
  })
})

describe('isEnvIgnored', () => {
  it('finds .env in a gitignore', () => {
    expect(isEnvIgnored('node_modules\n.env\n')).toBe(true)
    expect(isEnvIgnored('/.env\r\n')).toBe(true)
    expect(isEnvIgnored('.env*\n')).toBe(true)
  })

  it('does not count .env.example', () => {
    expect(isEnvIgnored('node_modules\n!.env.example\n')).toBe(false)
    expect(isEnvIgnored('')).toBe(false)
  })
})

describe('isPrivateKeyReadable', () => {
  it('accepts the three formats', () => {
    expect(isPrivateKeyReadable(privateKey)).toBe(true)
    expect(isPrivateKeyReadable(privateKey.trim().replaceAll('\n', '\\n'))).toBe(true)
    expect(isPrivateKeyReadable(Buffer.from(privateKey).toString('base64'))).toBe(true)
  })

  it('refuses an empty value and a value that is not a key', () => {
    expect(isPrivateKeyReadable('')).toBe(false)
    expect(isPrivateKeyReadable('nope')).toBe(false)
    expect(isPrivateKeyReadable('-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----')).toBe(false)
  })
})

describe('computeSetupChecks', () => {
  const ok = {
    repo: 'acme/site',
    sessionPassword: 's'.repeat(32),
    appId: '4242',
    clientId: 'Iv1.abc',
    clientSecret: 'shh',
    privateKey,
  }

  it('is ready when the five values are fine', () => {
    const result = computeSetupChecks(ok)

    expect(result.ready).toBe(true)
    expect(result.checks.map((check) => check.id)).toEqual(['repo', 'sessionPassword', 'appId', 'clientId', 'clientSecret', 'privateKey'])
    expect(result.checks.every((check) => check.ok)).toBe(true)
  })

  it('is not ready when a value is missing', () => {
    for (const key of ['sessionPassword', 'appId', 'clientId', 'clientSecret', 'privateKey'] as const) {
      const result = computeSetupChecks({ ...ok, [key]: '' })

      expect(result.ready, key).toBe(false)
      expect(result.checks.find((check) => check.id === key)?.ok, key).toBe(false)
    }
  })

  it('needs a session password of 32 characters', () => {
    expect(computeSetupChecks({ ...ok, sessionPassword: 's'.repeat(31) }).ready).toBe(false)
  })

  it('needs a key that parses', () => {
    const result = computeSetupChecks({ ...ok, privateKey: 'garbage' })

    expect(result.ready).toBe(false)
    expect(result.checks.find((check) => check.id === 'privateKey')?.ok).toBe(false)
  })

  it('does not count the repo in ready, but it shows in the checks', () => {
    const result = computeSetupChecks({ ...ok, repo: '' })

    expect(result.ready).toBe(true)
    expect(result.checks.find((check) => check.id === 'repo')?.ok).toBe(false)
  })

  it('adds the installation check only when the caller sets it', () => {
    expect(computeSetupChecks({ ...ok, installed: false }).checks.at(-1)).toEqual({ id: 'installation', ok: false })
    expect(computeSetupChecks({ ...ok, installed: true }).checks.at(-1)).toEqual({ id: 'installation', ok: true })
    expect(computeSetupChecks(ok).checks.some((check) => check.id === 'installation')).toBe(false)
  })

  it('holds booleans and ids only, never a value', () => {
    const text = JSON.stringify(computeSetupChecks({ ...ok, installed: true }))

    expect(text).not.toContain('shh')
    expect(text).not.toContain('Iv1')
    expect(text).not.toContain('BEGIN')
    expect(text).not.toContain(ok.sessionPassword)
  })
})

describe('needsInstallationCheck', () => {
  it('needs a repo, an app id and a key that parses', () => {
    expect(needsInstallationCheck({ repo: 'acme/site', appId: '1', privateKey })).toBe(true)
    expect(needsInstallationCheck({ repo: '', appId: '1', privateKey })).toBe(false)
    expect(needsInstallationCheck({ repo: 'acme/site', appId: '', privateKey })).toBe(false)
    expect(needsInstallationCheck({ repo: 'acme/site', appId: '1', privateKey: 'x' })).toBe(false)
  })
})

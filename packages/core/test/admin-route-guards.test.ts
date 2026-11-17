import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = resolve(__dirname, '..')
const CORE_ROUTES = join(ROOT, 'server/api/_pluto')
const GITHUB_ROUTES = join(ROOT, 'modules/pluto-github/runtime/server/api')
const CORE_HANDLER_FILES = [
  'server/utils/pluto-content-handlers.ts',
  'server/utils/pluto-media.ts',
  'server/mail/handlers.ts',
].map((file) => join(ROOT, file))

const CORE_GUARD =
  /authorizeContentRead\(|authorizeContentOperation\(|authorizeRevisions\(|authorizeBackup\(|requireMailAdmin\(|driver\.authorize\(/

const GITHUB_GUARD =
  /requireGithubSession\(|requireGithubCapability\(|assertSetupAllowed\(|localRoot\(|isLocalMode\(|isDevLocal\(/

const GITHUB_PUBLIC = new Set([
  'auth/github/callback.get.ts',
  'auth/github/login.get.ts',
  'auth/logout.post.ts',
  'auth/session.get.ts',
  'setup/callback.get.ts',
  'setup/start.get.ts',
  'setup/status.get.ts',
])

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? walk(path) : [path]
  })
}

function routeFiles(dir: string): string[] {
  return walk(dir).filter((path) =>
    /\.(?:get|post|put|patch|delete)\.ts$/.test(path)
  )
}

function functionBody(source: string, name: string): string | undefined {
  const start = source.search(
    new RegExp(`export (?:async )?function ${name}\\b`)
  )

  if (start === -1) {
    return undefined
  }

  const rest = source.slice(start + 1)
  const next = rest.search(/\nexport /)

  return next === -1 ? rest : rest.slice(0, next)
}

function calledNames(source: string): string[] {
  return [...source.matchAll(/\b([a-z_]\w*)\(/gi)].map((match) => match[1]!)
}

function coreBodies(): Map<string, string> {
  const bodies = new Map<string, string>()

  for (const file of CORE_HANDLER_FILES) {
    const source = readFileSync(file, 'utf8')

    for (const match of source.matchAll(
      /export (?:async )?function (\w+)\b/g
    )) {
      bodies.set(match[1]!, functionBody(source, match[1]!) ?? '')
    }
  }

  return bodies
}

describe('the admin routes of core', () => {
  const bodies = coreBodies()
  const files = routeFiles(CORE_ROUTES)

  it('finds the route files', () => {
    expect(files.length).toBeGreaterThan(20)
  })

  for (const file of files) {
    const name = relative(CORE_ROUTES, file).replaceAll('\\', '/')

    it(`${name} reaches an authorization check`, () => {
      const source = readFileSync(file, 'utf8')
      const direct = CORE_GUARD.test(source)
      const through = calledNames(source).some((called) =>
        CORE_GUARD.test(bodies.get(called) ?? '')
      )

      expect(direct || through).toBe(true)
    })
  }
})

describe('the admin routes of the Git CMS module', () => {
  const files = routeFiles(GITHUB_ROUTES)

  for (const file of files) {
    const name = relative(GITHUB_ROUTES, file).replaceAll('\\', '/')

    if (GITHUB_PUBLIC.has(name)) {
      continue
    }

    it(`${name} reaches a session check`, () => {
      const source = readFileSync(file, 'utf8')
      const imports = [
        ...source.matchAll(/import \{([^}]+)\} from '(\.[^']+)'/g),
      ]
      const bodies = imports.flatMap((match) => {
        const target = `${resolve(dirname(file), match[2]!)}.ts`
        const text = readFileSync(target, 'utf8')

        return match[1]!
          .split(',')
          .map((one) => one.trim())
          .filter(Boolean)
          .map((one) => functionBody(text, one) ?? '')
      })

      expect(
        GITHUB_GUARD.test(source) ||
          bodies.some((body) => GITHUB_GUARD.test(body))
      ).toBe(true)
    })
  }
})

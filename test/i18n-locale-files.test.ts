import type { FlatMessages } from '../app/composables/internal/i18n-core'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'
import { countPluralForms, flattenMessages } from '../app/composables/internal/i18n-core'

// Checks every core locale file against the others: same keys, same
// placeholders, same plural forms. A new language is checked by adding its file.
const dir = join(__dirname, '..', 'i18n', 'locales')
const codes = readdirSync(dir)
  .filter((name) => name.endsWith('.json'))
  .map((name) => name.slice(0, -'.json'.length))

const locales: Record<string, FlatMessages> = {}
for (const code of codes) {
  locales[code] = flattenMessages(JSON.parse(readFileSync(join(dir, `${code}.json`), 'utf8')))
}

function placeholders(message: string): string[] {
  return [...message.matchAll(/\{(\w+)\}/g)].map((match) => match[1]!).toSorted()
}

describe('core locale files', () => {
  it('include en and pt-BR', () => {
    expect(codes).toContain('en')
    expect(codes).toContain('pt-BR')
  })

  for (const code of codes.filter((code) => code !== 'en')) {
    describe(code, () => {
      it('has every key of en, and no other key', () => {
        expect(Object.keys(locales[code]!).toSorted()).toEqual(Object.keys(locales.en!).toSorted())
      })

      it('uses the same placeholders as en for each key', () => {
        for (const [key, message] of Object.entries(locales.en!)) {
          expect(placeholders(locales[code]![key] ?? ''), key).toEqual(placeholders(message))
        }
      })

      it('has the same number of plural forms as en for each key', () => {
        for (const [key, message] of Object.entries(locales.en!)) {
          expect(countPluralForms(locales[code]![key] ?? ''), key).toBe(countPluralForms(message))
        }
      })
    })
  }

  for (const code of codes) {
    it(`${code} has no empty value`, () => {
      for (const [key, message] of Object.entries(locales[code]!)) {
        expect(message.trim(), key).not.toBe('')
      }
    })

    it(`${code} has only known namespaces at the top`, () => {
      // `content` holds the translations of content types. A layer that
      // declares a type adds them. Core declares no type, so core's files
      // have none.
      const namespaces = new Set(Object.keys(locales[code]!).map((key) => key.split('.')[0]!))

      expect([...namespaces].filter((name) => !['pluto', 'content'].includes(name))).toEqual([])
      expect(namespaces.has('pluto')).toBe(true)
    })
  }
})

// --- Usage check ------------------------------------------------------------
//
// Every literal `pluto.*` key in the source must exist in en.json. A key with a
// typo shows as the raw key in the UI. For a registry string, `tx()` hides it,
// because the unknown value stays as it is. This test finds both.
const root = join(__dirname, '..')

function sourceFiles(dir: string): string[] {
  return readdirSync(join(root, dir), { recursive: true, encoding: 'utf8' })
    .map((name) => join(root, dir, name))
    .filter((file) => /\.(?:ts|vue)$/.test(file) && !file.endsWith('.d.ts') && statSync(file).isFile())
}

const KEY = /^pluto(?:\.[\w-]+)+$/

// `t('key')`, `tx('key')` and `te('key')`.
const CALLS = /\b(?:t|tx|te)\(\s*(['"`])([^'"`$]+)\1/g
// `key: 'key'`, the key of a `createPlutoError` call.
const KEY_PROPS = /\bkey:\s*(['"`])([^'"`$]+)\1/g
// Any string that looks like a key. Plugin registrations hold keys as plain values.
const LITERALS = /(['"])(pluto(?:\.[\w-]+)+)\1/g

function usedKeys(): Map<string, string[]> {
  const used = new Map<string, string[]>()

  for (const file of ['app', 'shared', 'server'].flatMap(sourceFiles)) {
    const text = readFileSync(file, 'utf8')
    const name = relative(root, file).replaceAll('\\', '/')
    const patterns = name.startsWith('app/plugins/') ? [CALLS, KEY_PROPS, LITERALS] : [CALLS, KEY_PROPS]

    for (const pattern of patterns) {
      for (const match of text.matchAll(pattern)) {
        const key = match[2]!
        if (KEY.test(key)) {
          used.set(key, [...(used.get(key) ?? []), name])
        }
      }
    }
  }

  return used
}

describe('core locale keys in use', () => {
  const used = usedKeys()

  it('finds the keys of the core UI', () => {
    expect(used.size).toBeGreaterThan(50)
    expect(used.has('pluto.nav.home')).toBe(true)
    expect(used.has('pluto.errors.notFound')).toBe(true)
  })

  it('has every used pluto key in en.json', () => {
    const missing = [...used]
      .filter(([key]) => !(key in locales.en!))
      .map(([key, files]) => `${key} (${[...new Set(files)].join(', ')})`)

    expect(missing).toEqual([])
  })

  it('has the keys that are built from a validation code', () => {
    for (const code of ['required', 'number', 'integer', 'min', 'max', 'boolean', 'option', 'maxLength']) {
      expect(locales.en![`pluto.validation.${code}`], code).toBeDefined()
    }
  })
})

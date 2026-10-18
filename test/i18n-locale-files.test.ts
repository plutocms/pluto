import type { FlatMessages } from '../app/composables/internal/i18n-core'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
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
      // `content` joins in a later pass, for content types.
      const namespaces = new Set(Object.keys(locales[code]!).map((key) => key.split('.')[0]!))

      expect([...namespaces].filter((name) => !['pluto', 'content'].includes(name))).toEqual([])
      expect(namespaces.has('pluto')).toBe(true)
    })
  }
})

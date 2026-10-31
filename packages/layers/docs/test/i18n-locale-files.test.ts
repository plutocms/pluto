import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createDocsType } from '../shared/utils/docs-type'

// Checks every locale file of this layer against en: same keys, same
// placeholders. A new language is checked by adding its file. Every literal key
// in the code must exist in en.
//
// A translation also holds the core convention keys of the default `doc` type
// (`content.doc.*`). en has none: the English text is in the type itself, and an
// en key would hide a custom `label` option.
const root = join(__dirname, '..')
const dir = join(root, 'i18n', 'locales')
const codes = readdirSync(dir)
  .filter((name) => name.endsWith('.json'))
  .map((name) => name.slice(0, -'.json'.length))

type FlatMessages = Record<string, string>

function flatten(
  value: unknown,
  prefix = '',
  out: FlatMessages = {}
): FlatMessages {
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${key}` : key
    if (typeof child === 'string') {
      out[path] = child
    } else {
      flatten(child, path, out)
    }
  }
  return out
}

const locales: Record<string, FlatMessages> = {}
for (const code of codes) {
  locales[code] = flatten(
    JSON.parse(readFileSync(join(dir, `${code}.json`), 'utf8'))
  )
}

/** The keys of the layer namespace only. */
function own(messages: FlatMessages): string[] {
  return Object.keys(messages).filter((key) => key.startsWith('docs.'))
}

function placeholders(message: string): string[] {
  return [...message.matchAll(/\{(\w+)\}/g)]
    .map((match) => match[1]!)
    .toSorted()
}

describe('docs locale files', () => {
  it('include en and pt-BR', () => {
    expect(codes).toContain('en')
    expect(codes).toContain('pt-BR')
  })

  for (const code of codes.filter((name) => name !== 'en')) {
    it(`${code} has the keys and the placeholders of en`, () => {
      expect(own(locales[code]!).toSorted()).toEqual(
        own(locales.en!).toSorted()
      )
      for (const [key, message] of Object.entries(locales.en!)) {
        expect(placeholders(locales[code]![key] ?? ''), key).toEqual(
          placeholders(message)
        )
      }
    })
  }

  for (const code of codes) {
    it(`${code} has only the docs namespace and the doc type keys, and no empty value`, () => {
      for (const key of Object.keys(locales[code]!)) {
        expect(
          key.startsWith('docs.') || key.startsWith('content.doc.'),
          key
        ).toBe(true)
      }
      for (const [key, message] of Object.entries(locales[code]!)) {
        expect(message.trim(), key).not.toBe('')
      }
    })
  }
})

function sourceFiles(folder: string): string[] {
  const files: string[] = []
  for (const name of readdirSync(folder)) {
    const path = join(folder, name)
    if (statSync(path).isDirectory()) {
      files.push(...sourceFiles(path))
    } else if (/\.(?:ts|vue)$/.test(name) && !name.endsWith('.d.ts')) {
      files.push(path)
    }
  }
  return files
}

// The core rule of `isMessageKey` (pluto, i18n-core.ts): a lowercase namespace,
// then one or more dotted parts. A label in the registry (an action, a
// capability) is translated only when it matches, so a key that does not
// match shows as raw text.
function isCoreMessageKey(key: string): boolean {
  const [namespace, ...parts] = key.split('.')
  return (
    /^[a-z][a-z0-9-]*$/.test(namespace!) &&
    parts.length > 0 &&
    parts.every((part) => /^[\w-]+$/.test(part))
  )
}

describe('the layer keys', () => {
  it('match the core key rule, so tx() translates them', () => {
    for (const key of Object.keys(locales.en!)) {
      expect(isCoreMessageKey(key), key).toBe(true)
    }
  })
})

describe('the doc type keys', () => {
  const type = createDocsType({ name: 'doc', source: '' })
  const fields = new Set(type.fields.map((field) => field.name))

  it('are not in en', () => {
    expect(
      Object.keys(locales.en!).filter((key) => key.startsWith('content.'))
    ).toEqual([])
  })

  for (const code of codes.filter((name) => name !== 'en')) {
    it(`${code} names only real fields and has both labels`, () => {
      const keys = Object.keys(locales[code]!).filter((key) =>
        key.startsWith('content.doc.')
      )
      expect(keys).toContain('content.doc.label')
      expect(keys).toContain('content.doc.labelPlural')
      for (const key of keys.filter((key) =>
        key.startsWith('content.doc.fields.')
      )) {
        expect(fields.has(key.split('.')[3]!), key).toBe(true)
      }
    })
  }
})

describe('docs i18n keys in the code', () => {
  it('exist in en', () => {
    const keys = new Set<string>()
    for (const folder of ['app', 'shared', 'modules', 'server']) {
      for (const file of sourceFiles(join(root, folder))) {
        for (const match of readFileSync(file, 'utf8').matchAll(
          /(['"`])(docs.[\w-]+(?:\.[\w-]+)+)\1/g
        )) {
          keys.add(match[2]!)
        }
      }
    }
    expect(keys.size).toBeGreaterThan(0)
    for (const key of keys) {
      expect(locales.en![key], key).toBeDefined()
    }
  })
})

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

function source(path: string): string {
  return readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8')
}

function widgetNames(text: string): string[] {
  return [...text.matchAll(/widget: '([\w-]+)'/g)].map((match) => match[1]!)
}

describe('the field widgets of core', () => {
  const registered = widgetNames(
    source('../app/plugins/pluto-core-registrations.ts')
  )

  it('registers the blocks widget', () => {
    expect(registered).toContain('blocks')
  })

  it('registers every widget that the docs layer types use', () => {
    const used = widgetNames(
      source('../../layers/docs/shared/utils/docs-type.ts')
    )

    expect(used.length).toBeGreaterThan(0)

    for (const name of used) {
      expect(registered, name).toContain(name)
    }
  })
})

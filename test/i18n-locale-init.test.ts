import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// The admin is client-only. A client plugin that reads `usePlutoI18n()` before
// the `pluto-i18n` plugin used to create the locale state with the default
// locale, so the stored choice (the cookie) was lost on reload. These checks
// keep both parts of the fix. They ignore the whitespace, so a formatter
// (Prettier) that wraps a line does not break them.
const code = (text: string) => text.replace(/\s+/g, '')
const read = (path: string) =>
  code(readFileSync(join(__dirname, '..', path), 'utf8'))

describe('admin locale on a client-only page', () => {
  it('creates every locale state with the stored choice, not the default locale', () => {
    const scope = read('app/composables/pluto-i18n.ts')
    expect(scope).toContain(code('-locale`, () => resolveScopeLocale(scope)'))
    expect(scope).not.toContain(code('-locale`, () => config.defaultLocale'))

    const plugin = read('app/plugins/pluto-i18n.ts')
    expect(plugin).toContain(
      code(
        "useState<string>('pluto-admin-locale', () => resolveScopeLocale('admin'))"
      )
    )
    expect(plugin).toContain(
      code(
        "useState<string>('pluto-site-locale', () => resolveScopeLocale('site'))"
      )
    )
  })

  it('runs the auth sync after the i18n plugin', () => {
    const sync = read('app/plugins/pluto-auth-sync.client.ts')
    expect(sync).toContain(code("name: 'pluto-auth-sync'"))
    expect(sync).toContain(code("dependsOn: ['pluto-i18n']"))
    expect(read('app/plugins/pluto-i18n.ts')).toContain(
      code("name: 'pluto-i18n'")
    )
  })
})

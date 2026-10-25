import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// The admin is client-only. A client plugin that reads `usePlutoI18n()` before
// the `pluto-i18n` plugin used to create the locale state with the default
// locale, so the stored choice (the cookie) was lost on reload. These checks
// keep both parts of the fix.
const read = (path: string) => readFileSync(join(__dirname, '..', path), 'utf8')

describe('admin locale on a client-only page', () => {
  it('creates every locale state with the stored choice, not the default locale', () => {
    const scope = read('app/composables/pluto-i18n.ts')
    expect(scope).toContain('-locale`, () => resolveScopeLocale(scope))')
    expect(scope).not.toContain('-locale`, () => config.defaultLocale)')

    const plugin = read('app/plugins/pluto-i18n.ts')
    expect(plugin).toContain('useState<string>(\'pluto-admin-locale\', () => resolveScopeLocale(\'admin\'))')
    expect(plugin).toContain('useState<string>(\'pluto-site-locale\', () => resolveScopeLocale(\'site\'))')
  })

  it('runs the auth sync after the i18n plugin', () => {
    const sync = read('app/plugins/pluto-auth-sync.client.ts')
    expect(sync).toContain('name: \'pluto-auth-sync\'')
    expect(sync).toContain('dependsOn: [\'pluto-i18n\']')
    expect(read('app/plugins/pluto-i18n.ts')).toContain('name: \'pluto-i18n\'')
  })
})

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const read = (path: string) =>
  readFileSync(new URL(path, import.meta.url), 'utf8').replace(
    /^\s*\/\/.*$/gm,
    ''
  )

describe('the shop add-on', () => {
  it('does not extend core, so an app loads core once (through its backend layer)', () => {
    expect(read('../nuxt.config.ts')).not.toMatch(/extends:/)
  })

  it('loads the cart in the browser only', () => {
    expect(
      readFileSync(
        new URL('../app/plugins/cart.client.ts', import.meta.url),
        'utf8'
      )
    ).toContain('onNuxtReady')
  })

  it('has no stock rule by default: a backend layer names its fields', () => {
    const config = read('../app/app.config.ts')
    expect(config).toContain("stockField: ''")
    expect(config).toContain("madeToOrderField: ''")
    expect(config).toContain('maxQuantity: 99')
  })
})

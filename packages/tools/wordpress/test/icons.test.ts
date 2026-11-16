import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'
import {
  DEFAULT_ICON,
  iconName,
  lucideIcons,
  mapIcon,
  networkOf,
} from '../src/icons'

const require = createRequire(import.meta.url)
const lucide = require('@iconify-json/lucide/icons.json') as {
  icons: Record<string, unknown>
  aliases?: Record<string, unknown>
}

describe('icons', () => {
  it('takes the name out of a Font Awesome class', () => {
    expect(iconName('fas fa-star')).toBe('star')
    expect(iconName('fa-brands fa-facebook-f')).toBe('facebook-f')
    expect(iconName('far fa-heart fa-fw')).toBe('heart')
    expect(iconName('nothing')).toBeUndefined()
  })

  it('maps a Font Awesome icon to Lucide', () => {
    expect(
      mapIcon({ value: 'fas fa-star', library: 'fa-solid' })
    ).toMatchObject({
      icon: 'i-lucide-star',
      mapped: true,
    })
    expect(mapIcon('fab fa-facebook').icon).toBe('i-lucide-facebook')
    expect(mapIcon('fas fa-home').icon).toBe('i-lucide-house')
  })

  it('falls back to the default icon for an unknown name', () => {
    expect(mapIcon('fas fa-unknown-thing')).toEqual({
      icon: DEFAULT_ICON,
      mapped: false,
      source: 'fas fa-unknown-thing',
    })
    expect(mapIcon({ value: { url: 'a.svg' }, library: 'svg' }).mapped).toBe(
      false
    )
    expect(mapIcon(undefined).mapped).toBe(false)
  })

  it('names the social network of an icon', () => {
    expect(networkOf({ value: 'fab fa-linkedin-in' })).toBe('linkedin')
    expect(networkOf({ value: 'fas fa-envelope' })).toBe('email')
    expect(networkOf({ value: 'fab fa-tiktok' })).toBeUndefined()
  })

  it('maps only to icons that Lucide has', () => {
    const known = new Set([
      ...Object.keys(lucide.icons),
      ...Object.keys(lucide.aliases ?? {}),
    ])
    const missing = [DEFAULT_ICON, ...lucideIcons()].filter(
      (icon) => !known.has(icon.replace('i-lucide-', ''))
    )

    expect(missing).toEqual([])
  })
})

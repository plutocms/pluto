import { describe, expect, it } from 'vitest'
import {
  inspectRootComponent,
  siteHasOwnApp,
} from '../modules/pluto-root/inspect'

describe('inspectRootComponent', () => {
  it('finds PlutoRoot, and leaves such a root alone', () => {
    expect(
      inspectRootComponent('<template><PlutoRoot><NuxtPage /></PlutoRoot></template>')
    ).toEqual({ usesPlutoRoot: true, hasUApp: false })
    expect(inspectRootComponent('<template><pluto-root /></template>').usesPlutoRoot).toBe(true)
  })

  it('finds the UApp of a theme root', () => {
    expect(
      inspectRootComponent('<template>\n  <UApp :locale="locale">\n    <NuxtPage />\n  </UApp>\n</template>')
    ).toEqual({ usesPlutoRoot: false, hasUApp: true })
    expect(inspectRootComponent('<template><u-app><NuxtPage/></u-app></template>').hasUApp).toBe(true)
  })

  it('reads a plain root as neither', () => {
    expect(
      inspectRootComponent('<template><NuxtLayout><NuxtPage /></NuxtLayout></template>')
    ).toEqual({ usesPlutoRoot: false, hasUApp: false })
  })

  it('does not count a longer tag name or a comment', () => {
    expect(inspectRootComponent('<template><UAppHeader /></template>').hasUApp).toBe(false)
    expect(inspectRootComponent('<template><!-- <PlutoRoot> --><NuxtPage /></template>').usesPlutoRoot).toBe(false)
  })
})

describe('siteHasOwnApp', () => {
  it('follows the root, unless the app says', () => {
    const info = { usesPlutoRoot: false, hasUApp: true }
    expect(siteHasOwnApp(info, 'auto')).toBe(true)
    expect(siteHasOwnApp(info, undefined)).toBe(true)
    expect(siteHasOwnApp(info, false)).toBe(false)
    expect(siteHasOwnApp({ usesPlutoRoot: false, hasUApp: false }, true)).toBe(true)
  })
})

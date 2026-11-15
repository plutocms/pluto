import { describe, expect, it } from 'vitest'
import { PRESET_COMPONENT_NAMES } from '../shared/utils/block-preset-components'
import { BLOCK_PRESETS } from '../shared/utils/block-presets'

describe('the preset components', () => {
  it('list every Nuxt UI preset and nothing else', () => {
    const nuxtUi = Object.keys(BLOCK_PRESETS).filter((name) =>
      name.startsWith('u-')
    )
    expect([...PRESET_COMPONENT_NAMES].toSorted()).toEqual(nuxtUi.toSorted())
  })
})

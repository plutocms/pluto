import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import ScrollArea from '../../app/components/ScrollArea.vue'

describe('scrollArea', () => {
  it('renders slot content', async () => {
    const wrapper = await mountSuspended(ScrollArea, {
      slots: { default: '<p class="scroll-child">Scrollable content</p>' },
    })
    expect(wrapper.find('.scroll-child').text()).toBe('Scrollable content')
  })

  it('renders without errors with no props', async () => {
    const wrapper = await mountSuspended(ScrollArea)
    expect(wrapper.exists()).toBe(true)
  })
})

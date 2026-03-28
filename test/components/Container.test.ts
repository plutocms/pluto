import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import Container from '../../app/components/Container.vue'

describe('container', () => {
  it('renders slot content', async () => {
    const wrapper = await mountSuspended(Container, {
      slots: { default: '<span class="test-child">Hello</span>' },
    })
    expect(wrapper.find('.test-child').text()).toBe('Hello')
  })

  it('applies default layout classes', async () => {
    const wrapper = await mountSuspended(Container)
    const div = wrapper.find('div')
    expect(div.classes()).toContain('mx-auto')
    expect(div.classes()).toContain('px-4')
    expect(div.classes()).toContain('transition-all')
  })

  it('merges custom class prop with defaults', async () => {
    const wrapper = await mountSuspended(Container, {
      props: { class: 'my-custom-class' },
    })
    expect(wrapper.find('div').classes()).toContain('my-custom-class')
    expect(wrapper.find('div').classes()).toContain('mx-auto')
  })
})

import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import ModalFooter from '../../app/components/modal/ModalFooter.vue'

describe('modalFooter', () => {
  it('renders slot content', async () => {
    const wrapper = await mountSuspended(ModalFooter, {
      slots: { default: '<button class="action-btn">Confirm</button>' },
    })
    expect(wrapper.find('.action-btn').text()).toBe('Confirm')
  })

  it('defaults to center alignment', async () => {
    const wrapper = await mountSuspended(ModalFooter)
    expect(wrapper.find('.flex.py-4').classes()).toContain('justify-center')
  })

  it('applies left alignment when align is left', async () => {
    const wrapper = await mountSuspended(ModalFooter, {
      props: { align: 'left' },
    })
    expect(wrapper.find('.flex.py-4').classes()).toContain('justify-start')
  })

  it('applies right alignment when align is right', async () => {
    const wrapper = await mountSuspended(ModalFooter, {
      props: { align: 'right' },
    })
    expect(wrapper.find('.flex.py-4').classes()).toContain('justify-end')
  })

  it('shows the separator by default', async () => {
    const wrapper = await mountSuspended(ModalFooter)
    expect(wrapper.findComponent({ name: 'USeparator' }).exists()).toBe(true)
  })

  it('hides the separator when hideDivider is true', async () => {
    const wrapper = await mountSuspended(ModalFooter, {
      props: { hideDivider: true },
    })
    expect(wrapper.findComponent({ name: 'USeparator' }).exists()).toBe(false)
  })

  it('applies sticky bottom positioning class', async () => {
    const wrapper = await mountSuspended(ModalFooter)
    expect(wrapper.find('div').classes()).toContain('sticky')
  })

  it('merges custom class prop', async () => {
    const wrapper = await mountSuspended(ModalFooter, {
      props: { class: 'extra-footer-class' },
    })
    expect(wrapper.find('div').classes()).toContain('extra-footer-class')
  })
})

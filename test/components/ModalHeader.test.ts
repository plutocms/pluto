import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import ModalHeader from '../../app/components/modal/ModalHeader.vue'

describe('modalHeader', () => {
  it('renders slot content inside h2', async () => {
    const wrapper = await mountSuspended(ModalHeader, {
      slots: { default: 'Modal Title' },
    })
    expect(wrapper.find('h2').text()).toBe('Modal Title')
  })

  it('renders the close button by default', async () => {
    const wrapper = await mountSuspended(ModalHeader)
    // The close button container is visible when hideCloseButton is false
    const closeButtonContainer = wrapper.find('[class*="sr-only"]')
    expect(closeButtonContainer.exists()).toBe(true)
  })

  it('hides the close button when hideCloseButton is true', async () => {
    const wrapper = await mountSuspended(ModalHeader, {
      props: { hideCloseButton: true },
    })
    expect(wrapper.find('.sr-only').exists()).toBe(false)
  })

  it('emits close event when close button is clicked', async () => {
    const wrapper = await mountSuspended(ModalHeader, {
      props: { hideCloseButton: false },
    })
    await wrapper.find('button').trigger('click')
    expect(wrapper.emitted('close')).toBeTruthy()
    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  it('shows the separator by default', async () => {
    const wrapper = await mountSuspended(ModalHeader)
    // USeparator is rendered when hideDivider is false
    expect(wrapper.html()).toContain('separator')
  })

  it('hides the separator when hideDivider is true', async () => {
    const wrapper = await mountSuspended(ModalHeader, {
      props: { hideDivider: true },
    })
    // No USeparator when hideDivider is true
    expect(wrapper.findComponent({ name: 'USeparator' }).exists()).toBe(false)
  })

  it('applies default sticky positioning classes', async () => {
    const wrapper = await mountSuspended(ModalHeader)
    const root = wrapper.find('div')
    expect(root.classes()).toContain('sticky')
  })
})

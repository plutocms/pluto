import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import ModalContent from '../../app/components/modal/ModalContent.vue'

describe('modalContent', () => {
  it('renders default slot content', async () => {
    const wrapper = await mountSuspended(ModalContent, {
      slots: { default: '<p class="body-text">Modal body</p>' },
    })
    expect(wrapper.find('.body-text').text()).toBe('Modal body')
  })

  it('renders header slot when provided', async () => {
    const wrapper = await mountSuspended(ModalContent, {
      slots: {
        header: '<span class="sticky-header">Sticky Header</span>',
        default: '<p>Body</p>',
      },
    })
    expect(wrapper.find('.sticky-header').text()).toBe('Sticky Header')
  })

  it('does not render header container when header slot is empty', async () => {
    const wrapper = await mountSuspended(ModalContent, {
      slots: { default: '<p>Body only</p>' },
    })
    // v-if="$slots.header" means the sticky header wrapper is absent
    expect(wrapper.find('[style*="--header-top-offset"]').exists()).toBe(false)
  })
})

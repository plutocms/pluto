import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import AdminView from '../../app/components/AdminView.vue'

describe('adminView', () => {
  it('renders slot content inside the container', async () => {
    const wrapper = await mountSuspended(AdminView, {
      slots: {
        default: '<h1 class="admin-title">Admin Dashboard</h1>',
      },
    })
    expect(wrapper.find('.admin-title').text()).toBe('Admin Dashboard')
  })

  it('renders without errors with no slot', async () => {
    const wrapper = await mountSuspended(AdminView)
    expect(wrapper.exists()).toBe(true)
  })
})

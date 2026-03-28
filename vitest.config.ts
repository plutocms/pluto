import { defineVitestConfig } from '@nuxt/test-utils/config'

export default defineVitestConfig({
  test: {
    environment: 'nuxt',
  },

  plugins: [
    {
      name: 'ignore-bun-test',
      enforce: 'pre',
      resolveId(id) {
        if (id === 'bun:test') {
          return { id: 'bun:test', external: true }
        }
      },
    },
  ],
})

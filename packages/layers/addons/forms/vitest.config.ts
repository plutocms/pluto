import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  define: {
    'import.meta.dev': 'true',
  },
  resolve: {
    alias: {
      '#layers/pluto': fileURLToPath(new URL('../../../core', import.meta.url)),
    },
  },
  test: {
    setupFiles: ['./test/setup.ts'],
  },
})

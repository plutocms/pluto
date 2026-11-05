import { defineConfig } from 'vitest/config'

export default defineConfig({
  define: {
    'import.meta.dev': 'true',
  },
})

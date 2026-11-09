import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  define: {
    'import.meta.dev': 'true',
  },
  resolve: {
    // Nuxt gives `#layers/pluto` (the core layer) to the app. Plain Vitest needs it too.
    alias: {
      '#layers/pluto': fileURLToPath(new URL('../../core', import.meta.url)),
    },
  },
})

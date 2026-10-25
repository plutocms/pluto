import { loadPlutoLocale, resolveScopeLocale } from '../composables/internal/i18n-runtime'

// Resolves the admin locale and the site locale, and loads their messages and
// Nuxt UI locale before the first render. The locales live in `useState`, so
// the client reuses the value the server chose: no mismatch on hydration. The
// resolve runs only when the state is empty (the server, or a client-only
// route such as /admin/**).
export default defineNuxtPlugin({
  name: 'pluto-i18n',
  async setup() {
    const admin = useState<string>('pluto-admin-locale', () => resolveScopeLocale('admin'))
    const site = useState<string>('pluto-site-locale', () => resolveScopeLocale('site'))

    await Promise.all([loadPlutoLocale(admin.value), loadPlutoLocale(site.value)])
  },
})

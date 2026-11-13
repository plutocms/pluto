import {
  loadPlutoLocale,
  resolveScopeLocale,
} from '../composables/internal/i18n-runtime'

export default defineNuxtPlugin({
  name: 'pluto-i18n',
  async setup() {
    const admin = useState<string>('pluto-admin-locale', () =>
      resolveScopeLocale('admin')
    )
    const site = useState<string>('pluto-site-locale', () =>
      resolveScopeLocale('site')
    )

    await Promise.all([
      loadPlutoLocale(admin.value),
      loadPlutoLocale(site.value),
    ])
  },
})

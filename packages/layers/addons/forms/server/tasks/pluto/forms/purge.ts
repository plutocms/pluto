export default defineTask({
  meta: {
    name: 'pluto:forms:purge',
    description:
      'Deletes the form submissions that are older than the retention of their form.',
  },
  async run() {
    const { store } = resolveFormsStore()
    if (!store) {
      return { result: { purged: 0, failed: [] } }
    }
    const forms = (await listFormSummaries()).map((form) => ({
      handle: form.handle,
      retentionDays: form.settings.retentionDays,
    }))
    return { result: await purgeFormSubmissions(store, forms) }
  },
})

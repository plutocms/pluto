export default defineEventHandler(async (event) => {
  await requireFormsCapability(event, '*')
  const config = getFormsConfig()
  const choice = resolveFormsStore()
  const mail = await getPlutoMailStatus()

  return {
    store: {
      ok: choice.store !== null,
      source: choice.source,
      mount: choice.mount ?? null,
      dev: config.dev,
    },
    secret: {
      ok: config.secret !== '' && config.secretSource !== 'dev',
      source: config.secretSource,
    },
    turnstile: {
      on: Boolean(config.turnstileSecret && config.turnstileSiteKey),
      half:
        Boolean(config.turnstileSecret) !== Boolean(config.turnstileSiteKey),
    },
    mail: {
      driver: mail.driver,
      configured: mail.configured,
      logOnly: mail.logOnly,
    },
  }
})

import type { PlutoFormsRateLimiter } from './forms-spam'
import type { PlutoFormsHookContext, PlutoFormsSubmitDeps } from './forms-submit'

declare module 'nitropack' {
  interface NitroRuntimeHooks {
    /** Runs before the store keeps a submission. Call `context.reject(message)` to refuse it. */
    'pluto:forms:before-store': (
      context: PlutoFormsHookContext
    ) => void | Promise<void>
    /** Runs after the store kept a submission and the email went out. For a CRM, a webhook, a chat. */
    'pluto:forms:submission': (
      context: PlutoFormsHookContext
    ) => void | Promise<void>
  }
}

let limiter: PlutoFormsRateLimiter | undefined

/** The real parts that the submit route gives to `submitPlutoForm`. */
export function createFormsSubmitDeps(): PlutoFormsSubmitDeps {
  const config = getFormsConfig()
  limiter ??= createFormsRateLimiter({
    limit: config.rateLimit,
    windowMs: 60_000,
  })
  const hooks = useNitroApp().hooks

  return {
    config,
    limiter,
    store: resolveFormsStore().store,
    loadForm: loadFormDefinition,
    sendMail: (message) => sendPlutoMail(message),
    beforeStore: (context) =>
      hooks.callHook('pluto:forms:before-store', context),
    afterStore: (context) => hooks.callHook('pluto:forms:submission', context),
    validate: {
      custom: plutoFormCustomTypes(getFormsAppConfig().fieldTypes).validators,
    },
    siteName: String(useRuntimeConfig().public.websiteName ?? ''),
  }
}

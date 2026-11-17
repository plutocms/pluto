import type { H3Event } from 'h3'
import type { PlutoFormStore } from '../../shared/types/forms'
import type { PlutoFormsStorage } from './forms-store'

/**
 * Checks that the caller holds a capability. It fails closed: with no adapter that can check, the
 * answer is 403. The admin routes of the layer call it first.
 */
export async function requireFormsCapability(
  event: H3Event,
  capability: string
): Promise<void> {
  const adapter = getContentAdapter()
  if (!adapter?.authorize) {
    throw createPlutoError({
      statusCode: 403,
      message: 'Only a signed-in user with access can do this.',
      key: 'pluto.errors.forbidden',
    })
  }
  await adapter.authorize(event, capability)
}

export function requireFormHandle(event: H3Event): string {
  const handle = getRouterParam(event, 'handle') ?? ''
  if (!PLUTO_FORM_HANDLE.test(handle)) {
    throw createPlutoError({
      statusCode: 404,
      message: 'Not found.',
      key: 'pluto.errors.notFound',
    })
  }
  return handle
}

export function requireFormStore(): PlutoFormStore {
  const { store } = resolveFormsStore()
  if (!store) {
    throw createPlutoError({
      statusCode: 503,
      message: 'The site has no store for form submissions yet.',
      key: 'forms.errors.noStore',
    })
  }
  return store
}

/** The store choice for the running server: the registered store, a storage mount, or none. */
export function resolveFormsStore() {
  const config = getFormsConfig()
  return chooseFormStore({
    storageName: config.storage,
    dev: config.dev,
    devMount: PLUTO_FORMS_DEV_MOUNT,
    storage: useStorage() as unknown as PlutoFormsStorage,
  })
}

const FORM_ADMIN_PATH = /\/api\/_pluto\/content[\w-]*\/form(?:\/|$)/

/**
 * True for a path of the generic admin content routes that holds `form` items. Those routes let
 * an anonymous caller read the items of a type that has no read capability, and a form item holds
 * the email addresses of the recipients. The layer checks `forms:write` for these paths.
 */
export function isFormsAdminPath(pathname: string): boolean {
  return FORM_ADMIN_PATH.test(pathname)
}

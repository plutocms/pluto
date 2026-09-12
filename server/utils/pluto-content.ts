/**
 * The server-side content-type and adapter registry. Deliberately a plain
 * module-scope singleton — NOT built like `usePlutoRegistry` (the client
 * registry in `app/composables/pluto-registry.ts`), and that is on purpose,
 * not an oversight.
 *
 * The client registry lives on `nuxtApp` instead of module scope because a
 * module-scope object on the server would leak state between requests and
 * between apps during SSR: one user's data could end up rendered into
 * another user's response. That risk does not apply here, for three
 * reasons:
 *
 * 1. Registration happens once, at Nitro startup, from a layer's own
 *    `server/plugins/*.ts` file — not per request.
 * 2. The registered values (`PlutoContentType`, `PlutoContentAdapter`) are
 *    static definition objects. They hold zero per-request state.
 * 3. Anything that actually varies per request — the caller's identity,
 *    their session — travels in `PlutoContentContext.event`, which is
 *    passed fresh into every adapter call. It never touches the registry.
 *
 * So a future reader who knows why the client registry avoids module scope
 * should not assume the same warning applies here: it does not, because
 * nothing stored here ever differs between two requests.
 */

const contentTypes = new Map<string, PlutoContentType>()
let contentAdapter: PlutoContentAdapter | undefined

export function registerContentType(type: PlutoContentType): void {
  contentTypes.set(type.name, type)
}

export function getContentType(name: string): PlutoContentType | undefined {
  return contentTypes.get(name)
}

/** Replaces whatever adapter was registered before. Last-registered wins, the same rule `mediaAdapters`/`settingsDrivers` use client-side. */
export function registerContentAdapter(adapter: PlutoContentAdapter): void {
  contentAdapter = adapter
}

export function getContentAdapter(): PlutoContentAdapter | undefined {
  return contentAdapter
}

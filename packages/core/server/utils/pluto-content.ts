import type {
  PlutoContentAdapter,
  PlutoContentType,
  PlutoContentTypeExtension,
} from '../../shared/types/content'
import { applyContentTypeExtensions } from '../../shared/utils/content-extend'

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
// The extensions that layers add, by id, with the order of first registration.
const extensions = new Map<string, PlutoContentTypeExtension>()
const extensionSequence = new Map<string, number>()
// The extended types. Cleared on each register and extend, so a read costs one lookup.
const extendedTypes = new Map<string, PlutoContentType>()
let contentAdapter: PlutoContentAdapter | undefined

function orderedExtensions(): PlutoContentTypeExtension[] {
  return [...extensions.values()].sort(
    (a, b) =>
      (a.order ?? 100) - (b.order ?? 100) ||
      (extensionSequence.get(a.id) ?? 0) - (extensionSequence.get(b.id) ?? 0)
  )
}

/** Registers the raw type. `getContentType` and `listContentTypes` give it with the extensions. */
export function registerContentType(type: PlutoContentType): void {
  contentTypes.set(type.name, type)
  extendedTypes.clear()
}

/**
 * Adds an extension to every content type, the registered ones and the ones that register later.
 * A layer calls it from a `server/plugins/*.ts` file. The same `id` replaces the earlier
 * extension. The registered (raw) types stay unchanged.
 */
export function extendContentTypes(extension: PlutoContentTypeExtension): void {
  if (!extensionSequence.has(extension.id)) {
    extensionSequence.set(extension.id, extensionSequence.size)
  }
  extensions.set(extension.id, extension)
  extendedTypes.clear()
}

function extend(type: PlutoContentType): PlutoContentType {
  let extended = extendedTypes.get(type.name)
  if (!extended) {
    extended = applyContentTypeExtensions(type, orderedExtensions())
    extendedTypes.set(type.name, extended)
  }
  return extended
}

/** A content type with the extensions of the layers applied. */
export function getContentType(name: string): PlutoContentType | undefined {
  const type = contentTypes.get(name)
  return type && extend(type)
}

/** Every registered content type, with the extensions applied, in registration order. */
export function listContentTypes(): PlutoContentType[] {
  return [...contentTypes.values()].map(extend)
}

/** Replaces whatever adapter was registered before. Last-registered wins, the same rule `registerMediaDriver` and the client `settingsDrivers` use. */
export function registerContentAdapter(adapter: PlutoContentAdapter): void {
  contentAdapter = adapter
}

export function getContentAdapter(): PlutoContentAdapter | undefined {
  return contentAdapter
}

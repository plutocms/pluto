import type {
  PlutoContentAdapter,
  PlutoContentType,
  PlutoContentTypeExtension,
} from '../../shared/types/content'
import { applyContentTypeExtensions } from '../../shared/utils/content-extend'

const contentTypes = new Map<string, PlutoContentType>()
const extensions = new Map<string, PlutoContentTypeExtension>()
const extensionSequence = new Map<string, number>()
const extendedTypes = new Map<string, PlutoContentType>()
let contentAdapter: PlutoContentAdapter | undefined

function orderedExtensions(): PlutoContentTypeExtension[] {
  return [...extensions.values()].sort(
    (a, b) =>
      (a.order ?? 100) - (b.order ?? 100) ||
      (extensionSequence.get(a.id) ?? 0) - (extensionSequence.get(b.id) ?? 0)
  )
}

/**
 * Registers a content type on the server. `getContentType` and `listContentTypes` give it with the
 * extensions of the layers.
 *
 * @see https://pluto.vulmix.dev/docs/build/add-a-content-type#step-3-register-on-the-server
 */
export function registerContentType(type: PlutoContentType): void {
  contentTypes.set(type.name, type)
  extendedTypes.clear()
}

/**
 * Adds an extension to every content type, the registered ones and the ones that register later.
 * A layer calls it from a `server/plugins/*.ts` file. The same `id` replaces the earlier
 * extension. The registered (raw) types stay unchanged.
 *
 * @see https://pluto.vulmix.dev/docs/reference/content-model
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

/**
 * Registers the content adapter, the backend of every content type. The last adapter registered wins.
 *
 * @see https://pluto.vulmix.dev/docs/supabase/content-adapter
 */
export function registerContentAdapter(adapter: PlutoContentAdapter): void {
  contentAdapter = adapter
}

export function getContentAdapter(): PlutoContentAdapter | undefined {
  return contentAdapter
}
